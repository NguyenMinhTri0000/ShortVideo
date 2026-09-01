import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { GenericProductAdapter } from './adapters/generic-product.adapter';
import axios from 'axios';
import * as cheerio from 'cheerio';

export type AssetDiscoveryResult = {
  success: boolean;
  importedCount: number;
  newImages: string[];
  message?: string;
};

@Injectable()
export class AssetDiscoveryService {
  private readonly logger = new Logger(AssetDiscoveryService.name);
  private readonly genericAdapter = new GenericProductAdapter();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Search the internet for real product images, evaluate suitability,
   * download candidate image buffers, store them in MinIO, and append URLs to product.images.
   * If search results = 0, fallback to extracting product gallery directly from product.sourceUrl.
   */
  async discoverAndImportAssets(
    productId: string,
    maxImages = 5,
  ): Promise<AssetDiscoveryResult> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    const sourceUrl = product.sourceUrl || product.affiliateUrl || '';

    this.logger.log(
      `[AssetDiscovery]\nProduct: ${product.name} (${product.id})\nSource URL: ${sourceUrl || 'N/A'}`,
    );

    const cleanName = (product.name || '')
      .replace(/^Đang nghiên cứu.*/i, '')
      .replace(/^Sản phẩm từ.*/i, '')
      .trim();

    let sourceDomain = '';
    if (sourceUrl) {
      try {
        sourceDomain = new URL(sourceUrl).hostname;
      } catch {
        // ignore invalid URL
      }
    }

    // Build Search Queries
    const queries: string[] = [];

    if (product.brand && cleanName) {
      queries.push(`${product.brand} ${cleanName}`);
    }
    if (cleanName) {
      queries.push(cleanName);
      queries.push(`${cleanName} product image`);
    }
    if (sourceDomain && cleanName) {
      queries.push(`site:${sourceDomain} ${cleanName}`);
    }
    if (product.brand) {
      queries.push(`${product.brand} product`);
    }

    // Deduplicate queries
    const uniqueQueries = Array.from(new Set(queries.filter(Boolean)));

    this.logger.log(
      `[Queries]\n` + uniqueQueries.map((q, idx) => `- query ${idx + 1}: "${q}"`).join('\n'),
    );

    const candidateUrls: string[] = [];

    // Search Execution across queries
    for (const query of uniqueQueries) {
      const results = await this.searchCandidateImageUrls(query);
      if (results.length > 0) {
        candidateUrls.push(...results);
      }
      if (candidateUrls.length >= 10) break;
    }

    this.logger.log(
      `[Search]\nRaw results: ${candidateUrls.length}\nParsed results: ${candidateUrls.length}`,
    );

    // SOURCE URL FALLBACK: If web search returns 0 candidates and sourceUrl exists, extract gallery directly from sourceUrl!
    if (candidateUrls.length === 0 && sourceUrl) {
      this.logger.log(
        `[Fallback] Web search returned 0 results. Triggering Source URL Gallery Extraction for ${sourceUrl}`,
      );
      try {
        const rawExtracted = await this.genericAdapter.extract(sourceUrl);
        if (rawExtracted.images && rawExtracted.images.length > 0) {
          candidateUrls.push(...rawExtracted.images);
          this.logger.log(
            `[Fallback] Extracted ${rawExtracted.images.length} gallery images from Source URL`,
          );
        }
      } catch (fallbackErr) {
        this.logger.warn(`[Fallback] Source URL extraction failed: ${fallbackErr}`);
      }
    }

    this.logger.log(`[Extraction]\nImages found: ${candidateUrls.length}\nVideos found: 0`);

    if (candidateUrls.length === 0) {
      this.logger.warn(`[AssetDiscovery] No valid candidate images found for product ${productId}`);
      return {
        success: true,
        importedCount: 0,
        newImages: [],
        message: 'Không tìm thấy ảnh phù hợp trên Internet hoặc trang nguồn',
      };
    }

    // Filter & Deduplicate
    const existingSet = new Set((product.images || []).map((u) => u.trim()));
    const acceptedCandidates: string[] = [];
    const rejectedCandidates: string[] = [];

    for (const rawUrl of candidateUrls) {
      const cleaned = rawUrl.trim();
      if (existingSet.has(cleaned) || acceptedCandidates.includes(cleaned)) {
        rejectedCandidates.push(`${cleaned} (duplicate)`);
      } else if (!this.isValidImageUrl(cleaned)) {
        rejectedCandidates.push(`${cleaned} (invalid url/icon)`);
      } else {
        acceptedCandidates.push(cleaned);
      }
    }

    this.logger.log(
      `[Filtering]\nAccepted: ${acceptedCandidates.length}\nRejected: ${rejectedCandidates.length}`,
    );

    // Import Candidate Images
    const newlyImportedUrls: string[] = [];
    let duplicateCount = rejectedCandidates.filter((r) => r.includes('(duplicate)')).length;
    let failedCount = 0;

    for (let i = 0; i < acceptedCandidates.length && newlyImportedUrls.length < maxImages; i++) {
      const imgUrl = acceptedCandidates[i];
      try {
        const importedUrl = await this.downloadAndStoreImage(imgUrl, productId);
        if (importedUrl) {
          newlyImportedUrls.push(importedUrl);
        } else {
          failedCount++;
        }
      } catch (err) {
        failedCount++;
        this.logger.debug(
          `[Import] Failed downloading ${imgUrl}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (newlyImportedUrls.length > 0) {
      const updatedImages = [...(product.images || []), ...newlyImportedUrls];
      await this.prisma.product.update({
        where: { id: productId },
        data: { images: updatedImages },
      });
    }

    this.logger.log(
      `[Import]\nDownloaded: ${newlyImportedUrls.length}\nImported: ${newlyImportedUrls.length}\nDuplicate: ${duplicateCount}\nFailed: ${failedCount}`,
    );

    return {
      success: true,
      importedCount: newlyImportedUrls.length,
      newImages: newlyImportedUrls,
      message: `Đã tự động tìm và bổ sung ${newlyImportedUrls.length} hình ảnh sản phẩm thực tế.`,
    };
  }

  private async searchCandidateImageUrls(query: string): Promise<string[]> {
    const candidateUrls: string[] = [];

    try {
      const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2`;
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);

      // Extract image URLs from Bing's m attribute in a.iusc elements
      $('a.iusc').each((_, element) => {
        const mAttr = $(element).attr('m');
        if (mAttr) {
          try {
            const mJson = JSON.parse(mAttr);
            if (mJson.murl && typeof mJson.murl === 'string') {
              const url = mJson.murl.trim();
              if (this.isValidImageUrl(url)) {
                candidateUrls.push(url);
              }
            }
          } catch {
            // Ignore JSON parse errors
          }
        }
      });
    } catch (err) {
      this.logger.warn(
        `[AssetDiscovery] Image scraping failed for query "${query}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return candidateUrls;
  }

  private isValidImageUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
    const lower = url.toLowerCase();
    if (lower.includes('data:image/') || lower.endsWith('.svg') || lower.endsWith('.gif')) {
      return false;
    }
    if (
      lower.includes('favicon') ||
      lower.includes('logo') ||
      lower.includes('avatar') ||
      lower.includes('icon') ||
      lower.includes('sprite')
    ) {
      return false;
    }
    return true;
  }

  private async downloadAndStoreImage(
    imageUrl: string,
    productId: string,
  ): Promise<string | null> {
    const res = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 5000,
      signal: AbortSignal.timeout(5000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const contentType = (res.headers['content-type'] as string) || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return null;
    }

    const buffer = Buffer.from(res.data);
    // Minimum 10KB to avoid tiny thumbnails/logos
    if (buffer.length < 10240) {
      return null;
    }

    const ext = contentType.includes('png')
      ? 'png'
      : contentType.includes('webp')
      ? 'webp'
      : 'jpg';
    const timestamp = Date.now();
    const rand = Math.floor(Math.random() * 10000);
    const key = `product-assets/discovered-${productId.substring(0, 8)}-${timestamp}-${rand}.${ext}`;

    await this.storageService.uploadBuffer(buffer, key, contentType);
    const publicUrl = await this.storageService.getDownloadUrl(key, 604800);
    return publicUrl;
  }
}
