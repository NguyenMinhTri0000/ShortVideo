import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ProductAnalysisService } from './product-analysis.service';
import { ContentBriefService } from './content-brief.service';
import { ProductSourceAdapter } from './adapters/product-source.adapter';
import { GenericProductAdapter } from './adapters/generic-product.adapter';
import { ShopeeAdapter } from './adapters/shopee.adapter';
import { LazadaAdapter } from './adapters/lazada.adapter';
import { TikTokShopAdapter } from './adapters/tiktok-shop.adapter';
import { AmazonAdapter } from './adapters/amazon.adapter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { ProductResearchJobPayload } from './product-research.processor';
import type {
  ProductResearchResult,
  RawProductData,
  MarketingAngle,
} from './types/product-research.types';
import { ResearchStatus } from './types/product-research.types';
import { AssetDiscoveryService } from './asset-discovery.service';
import { UrlResolverService } from './url-resolver.service';

@Injectable()
export class ProductResearchService {
  private readonly logger = new Logger(ProductResearchService.name);
  private readonly adapters: ProductSourceAdapter[];
  private readonly resolver: UrlResolverService;

  constructor(
    private prisma: PrismaService,
    private productAnalysisService: ProductAnalysisService,
    private contentBriefService: ContentBriefService,
    private assetDiscoveryService: AssetDiscoveryService,
    private urlResolverService?: UrlResolverService,
    @InjectQueue('product-research')
    private researchQueue?: Queue<ProductResearchJobPayload>,
  ) {
    this.resolver = urlResolverService || new UrlResolverService();
    // Platform adapters registered in priority order before generic fallback
    this.adapters = [
      new ShopeeAdapter(),
      new LazadaAdapter(),
      new TikTokShopAdapter(),
      new AmazonAdapter(),
      new GenericProductAdapter(),
    ];
  }

  /**
   * API entrypoint: Accepts URL, selects adapter, creates pending Product record,
   * enqueues background worker job, and returns initial result immediately.
   */
  async researchProduct(url: string): Promise<ProductResearchResult> {
    this.logger.log(`[ProductResearch] Starting research for: ${url}`);

    if (!url || typeof url !== 'string' || !url.trim()) {
      throw new BadRequestException('Vui lòng cung cấp URL sản phẩm hợp lệ');
    }

    const cleanedUrl = url.trim();

    // Resolve & normalize URL before adapter selection
    const resolved = await this.resolver.resolveAndNormalizeUrl(cleanedUrl);
    const targetUrl = resolved.canonicalUrl || resolved.finalUrl;
    const adapter =
      this.selectAdapter(targetUrl) || this.selectAdapter(cleanedUrl);

    if (!adapter) {
      return {
        success: false,
        error: {
          code: 'NO_ADAPTER',
          message: 'Không hỗ trợ URL này. Vui lòng kiểm tra lại đường dẫn.',
        },
      };
    }

    // Create pending Product record
    const product = await this.prisma.product.create({
      data: {
        name: 'Đang nghiên cứu sản phẩm...',
        affiliateUrl: cleanedUrl,
        sourceUrl: targetUrl,
        sourcePlatform: adapter.name,
        researchStatus: ResearchStatus.PENDING,
      },
    });

    this.logger.log(
      `[Database] Initial pending Product created: ${product.id}`,
    );

    let jobId: string | undefined;

    // Enqueue job if BullMQ queue is available
    if (this.researchQueue) {
      try {
        const job = await this.researchQueue.add(
          'process-product-research',
          { productId: product.id, url: cleanedUrl },
          {
            attempts: 2,
            backoff: 5000,
            removeOnComplete: 100,
            removeOnFail: 200,
          },
        );
        jobId = job.id;
        this.logger.log(
          `[Worker] Enqueued research job ${jobId} for product ${product.id}`,
        );

        await this.prisma.product.update({
          where: { id: product.id },
          data: { researchStatus: ResearchStatus.PROCESSING },
        });
      } catch (queueErr) {
        this.logger.warn(
          `[Worker] Failed to enqueue job via Redis queue, falling back to inline execution: ${queueErr}`,
        );
        // Fallback to inline async execution
        this.executeResearchPipeline(product.id, cleanedUrl).catch((err) => {
          this.logger.error(
            `[Worker] Async inline research pipeline error: ${err}`,
          );
        });
      }
    } else {
      // Fallback to inline async execution
      this.executeResearchPipeline(product.id, cleanedUrl).catch((err) => {
        this.logger.error(
          `[Worker] Async inline research pipeline error: ${err}`,
        );
      });
    }

    return {
      success: true,
      jobId,
      product: this.mapProductToResult(product),
    };
  }

  /**
   * Worker / Queue Execution Pipeline:
   * Fetch -> Extract -> Normalize -> AI Analysis -> Content Brief -> DB Update
   */
  async executeResearchPipeline(
    productId: string,
    url: string,
  ): Promise<ProductResearchResult> {
    this.logger.log(
      `[ProductResearch] Executing pipeline for productId=${productId}`,
    );

    await this.prisma.product.update({
      where: { id: productId },
      data: { researchStatus: ResearchStatus.PROCESSING, researchError: null },
    });

    const resolved = await this.resolver.resolveAndNormalizeUrl(url);
    const targetUrl = resolved.canonicalUrl || resolved.finalUrl;
    const adapter = this.selectAdapter(targetUrl) || this.selectAdapter(url);

    if (!adapter) {
      throw new Error(`No adapter found for URL: ${targetUrl}`);
    }

    try {
      // Step 1: Extraction
      const platformName = adapter.name === 'shopee' ? 'Shopee' : adapter.name;
      this.logger.log(
        `[ProductResearch] Starting ${platformName} product extraction...`,
      );
      const rawData: RawProductData = await adapter.extract(targetUrl);

      if (
        !rawData.title &&
        !rawData.description &&
        rawData.images.length === 0
      ) {
        if (resolved.platform === 'shopee') {
          throw new Error(
            'Shopee product URL was resolved, but shop ID/item ID could not be extracted.',
          );
        }
        throw new Error(
          'Không thể trích xuất thông tin sản phẩm từ trang này. Trang có thể bị chặn hoặc không có nội dung.',
        );
      }

      this.logger.log(
        `[Normalize] Extracted raw product data: title="${rawData.title}", images=${rawData.images.length}, price="${rawData.price || 'N/A'}"`,
      );

      // Step 2: AI Analysis
      this.logger.log(`[AIAnalysis] Starting AI analysis...`);
      let aiAnalysis;
      let isPartial = false;

      try {
        aiAnalysis = await this.productAnalysisService.analyzeProduct(rawData);
        this.logger.log(
          `[AIAnalysis] Completed successfully: category="${aiAnalysis.category || 'N/A'}", angles=${aiAnalysis.marketingAngles.length}`,
        );
      } catch (aiErr) {
        isPartial = true;
        this.logger.warn(`[AIAnalysis] Warning during AI analysis: ${aiErr}`);
      }

      // Step 3: Content Brief Generation
      this.logger.log(
        `[ContentBrief] Generating reusable Product Content Brief...`,
      );
      const contentBrief = aiAnalysis
        ? this.contentBriefService.generateBrief(rawData, aiAnalysis)
        : null;

      // Step 4: DB Update
      const finalStatus = isPartial
        ? ResearchStatus.PARTIAL
        : ResearchStatus.COMPLETED;

      const derivedName =
        rawData.title?.trim() ||
        (contentBrief?.product && contentBrief.product !== 'Sản phẩm'
          ? contentBrief.product
          : null) ||
        (rawData.brand ? `Sản phẩm ${rawData.brand}` : null) ||
        (rawData.description ? rawData.description.substring(0, 60) : null) ||
        `Sản phẩm từ ${adapter.name}`;

      const updatedProduct = await this.prisma.product.update({
        where: { id: productId },
        data: {
          name: derivedName,
          brand: rawData.brand || aiAnalysis?.category || null,
          category: aiAnalysis?.category || rawData.category || null,
          description: rawData.description || aiAnalysis?.summary || null,
          price: rawData.price || null,
          originalPrice: rawData.originalPrice || null,
          currency: rawData.currency || 'VND',
          discountPercent: rawData.discountPercent || null,
          rating: rawData.rating || null,
          reviewCount: rawData.reviewCount || null,
          affiliateUrl: url,
          sourceUrl: targetUrl,
          sourcePlatform: adapter.name,
          images: rawData.images || [],
          videos: rawData.videos || [],
          features: aiAnalysis?.features || rawData.features || [],
          specifications: rawData.specifications
            ? (rawData.specifications as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
          benefits: aiAnalysis?.benefits || [],
          pros: aiAnalysis?.pros || [],
          cons: aiAnalysis?.cons || [],
          targetAudience: aiAnalysis?.targetAudience
            ? aiAnalysis.targetAudience.join(', ')
            : null,
          useCases: aiAnalysis?.useCases || [],
          usp: aiAnalysis?.usp || aiAnalysis?.sellingPoints || [],
          painPoints: aiAnalysis?.painPoints || [],
          marketingAngles: aiAnalysis?.marketingAngles
            ? (aiAnalysis.marketingAngles as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
          contentBrief: contentBrief
            ? (contentBrief as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
          researchRawData: rawData as unknown as Prisma.InputJsonValue,
          researchStatus: finalStatus,
          researchedAt: new Date(),
          researchError: null,
        },
      });

      this.logger.log(
        `[Database] Product saved successfully: id=${updatedProduct.id}, status=${finalStatus}`,
      );

      // Trigger Automatic Product Asset Discovery asynchronously
      this.assetDiscoveryService
        .discoverAndImportAssets(updatedProduct.id)
        .catch((err) => {
          this.logger.error(
            `[AssetDiscovery] Automatic asset discovery error: ${err}`,
          );
        });

      return {
        success: true,
        product: this.mapProductToResult(updatedProduct),
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[ProductResearch] Pipeline failed for productId=${productId}: ${errorMessage}`,
      );

      const failedProduct = await this.prisma.product
        .update({
          where: { id: productId },
          data: {
            researchStatus: ResearchStatus.FAILED,
            researchError: errorMessage,
            name: 'Nghiên cứu thất bại',
          },
        })
        .catch(() => null);

      return {
        success: false,
        product: failedProduct
          ? this.mapProductToResult(failedProduct)
          : undefined,
        error: {
          code: 'RESEARCH_FAILED',
          message: errorMessage,
        },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Status and detail lookups
  // ---------------------------------------------------------------------------

  async getProductResearchStatus(id: string): Promise<ProductResearchResult> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Không tìm thấy sản phẩm' },
      };
    }

    return {
      success: true,
      product: this.mapProductToResult(product),
    };
  }

  private selectAdapter(url: string): ProductSourceAdapter | null {
    for (const adapter of this.adapters) {
      if (adapter.canHandle(url)) {
        return adapter;
      }
    }
    return null;
  }

  private mapProductToResult(product: any) {
    return {
      id: product.id,
      name: product.name,
      brand: product.brand || null,
      category: product.category || null,
      description: product.description || null,
      price: product.price || null,
      originalPrice: product.originalPrice || null,
      currency: product.currency || 'VND',
      discountPercent: product.discountPercent || null,
      rating: product.rating || null,
      reviewCount: product.reviewCount || null,
      affiliateUrl: product.affiliateUrl,
      sourceUrl: product.sourceUrl || null,
      sourcePlatform: product.sourcePlatform || null,
      images: product.images || [],
      videos: product.videos || [],
      features: product.features || [],
      specifications: product.specifications || null,
      benefits: product.benefits || [],
      pros: product.pros || [],
      cons: product.cons || [],
      targetAudience: product.targetAudience || null,
      useCases: product.useCases || [],
      usp: product.usp || [],
      painPoints: product.painPoints || [],
      marketingAngles: product.marketingAngles as MarketingAngle[] | null,
      contentBrief: product.contentBrief,
      researchStatus: product.researchStatus || null,
      researchError: product.researchError || null,
      researchedAt: product.researchedAt || null,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
