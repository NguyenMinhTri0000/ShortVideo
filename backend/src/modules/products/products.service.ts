import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { QueueService, type VideoJobConfig } from '../queue/queue.service';
import { Prisma } from '@prisma/client';

export type CreateProductDto = {
  name: string;
  brand?: string;
  category?: string;
  description?: string;
  price?: string;
  originalPrice?: string;
  currency?: string;
  discountPercent?: number;
  rating?: number;
  reviewCount?: number;
  affiliateUrl: string;
  sourceUrl?: string;
  sourcePlatform?: string;
  features?: string[];
  specifications?: Record<string, any>;
  benefits?: string[];
  pros?: string[];
  cons?: string[];
  targetAudience?: string;
  useCases?: string[];
  usp?: string[];
  painPoints?: string[];
  marketingAngles?: any;
  contentBrief?: any;
  images?: string[];
  videos?: string[];
};

export type UpdateProductDto = Partial<CreateProductDto>;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
  ) {}

  async create(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        name: dto.name,
        brand: dto.brand,
        category: dto.category,
        description: dto.description,
        price: dto.price,
        originalPrice: dto.originalPrice,
        currency: dto.currency || 'VND',
        discountPercent: dto.discountPercent,
        rating: dto.rating,
        reviewCount: dto.reviewCount,
        affiliateUrl: dto.affiliateUrl,
        sourceUrl: dto.sourceUrl || dto.affiliateUrl,
        sourcePlatform: dto.sourcePlatform || 'generic',
        features: dto.features || [],
        specifications: dto.specifications
          ? (dto.specifications as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        benefits: dto.benefits || [],
        pros: dto.pros || [],
        cons: dto.cons || [],
        targetAudience: dto.targetAudience,
        useCases: dto.useCases || [],
        usp: dto.usp || [],
        painPoints: dto.painPoints || [],
        marketingAngles: dto.marketingAngles
          ? (dto.marketingAngles as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        contentBrief: dto.contentBrief
          ? (dto.contentBrief as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        images: dto.images || [],
        videos: dto.videos || [],
      },
    });
  }

  async findAll() {
    return this.prisma.product.findMany({
      include: {
        _count: {
          select: { ideas: true, jobs: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        ideas: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        jobs: {
          orderBy: { createdAt: 'desc' },
          include: {
            videos: true,
          },
          take: 10,
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.brand !== undefined && { brand: dto.brand }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.originalPrice !== undefined && { originalPrice: dto.originalPrice }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.discountPercent !== undefined && { discountPercent: dto.discountPercent }),
        ...(dto.rating !== undefined && { rating: dto.rating }),
        ...(dto.reviewCount !== undefined && { reviewCount: dto.reviewCount }),
        ...(dto.affiliateUrl && { affiliateUrl: dto.affiliateUrl }),
        ...(dto.sourceUrl !== undefined && { sourceUrl: dto.sourceUrl }),
        ...(dto.sourcePlatform && { sourcePlatform: dto.sourcePlatform }),
        ...(dto.features && { features: dto.features }),
        ...(dto.specifications !== undefined && {
          specifications: dto.specifications
            ? (dto.specifications as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
        }),
        ...(dto.benefits && { benefits: dto.benefits }),
        ...(dto.pros && { pros: dto.pros }),
        ...(dto.cons && { cons: dto.cons }),
        ...(dto.targetAudience !== undefined && { targetAudience: dto.targetAudience }),
        ...(dto.useCases && { useCases: dto.useCases }),
        ...(dto.usp && { usp: dto.usp }),
        ...(dto.painPoints && { painPoints: dto.painPoints }),
        ...(dto.marketingAngles !== undefined && {
          marketingAngles: dto.marketingAngles
            ? (dto.marketingAngles as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
        }),
        ...(dto.contentBrief !== undefined && {
          contentBrief: dto.contentBrief
            ? (dto.contentBrief as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
        }),
        ...(dto.images && { images: dto.images }),
        ...(dto.videos && { videos: dto.videos }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.product.delete({
      where: { id },
    });
  }

  /**
   * Integrated Video Generation pipeline:
   * Consumes product research data (Content Brief, selling points, marketing angles)
   * to enrich AI video script generation while maintaining 100% backward compatibility.
   */
  async generateVideo(id: string, config: VideoJobConfig = {}) {
    const product = await this.findOne(id);

    // Build rich context for video script generator if research contentBrief exists
    let topicDescription = product.description || `Sản phẩm: ${product.name}`;
    if (product.contentBrief && typeof product.contentBrief === 'object') {
      const brief = product.contentBrief as any;
      topicDescription = `[Product Content Brief]\nProduct: ${product.name}\nTarget Audience: ${brief.targetAudience || product.targetAudience || 'Khách hàng'}\nMain Pain Point: ${brief.mainPainPoint || ''}\nMain Benefit: ${brief.mainBenefit || ''}\nHook: ${brief.recommendedHook || ''}\nCTA: ${brief.recommendedCTA || ''}`;
    }

    // Create Idea associated with product
    const idea = await this.prisma.idea.create({
      data: {
        title: product.name,
        topic: product.name,
        description: topicDescription,
        language: 'vi',
        status: 'ready',
        productId: product.id,
      },
    });

    // Create GenerationJob associated with idea and product
    const job = await this.prisma.generationJob.create({
      data: {
        ideaId: idea.id,
        productId: product.id,
        status: 'queued',
        config,
      },
    });

    // Queue video generation job
    await this.queueService.addVideoJob(
      job.id,
      idea.id,
      product.name,
      undefined,
      'vi',
      {
        ...config,
        productId: product.id,
      },
    );

    this.logger.log(
      `[VideoIntegration] Created video job ${job.id} with product research brief context for product ${product.id}`,
    );

    return {
      product,
      idea,
      job,
    };
  }
}
