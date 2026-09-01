import { Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { ProductSourceAdapter } from './product-source.adapter';
import type { RawProductData } from '../types/product-research.types';

/** SSRF-blocked IP ranges and hostnames */
const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
  'metadata.google.internal',
  '169.254.169.254',
];

const BLOCKED_IP_PREFIXES = [
  '10.',
  '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.',
  '172.24.', '172.25.', '172.26.', '172.27.',
  '172.28.', '172.29.', '172.30.', '172.31.',
  '192.168.',
  '0.',
];

const FETCH_TIMEOUT_MS = 12_000;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * Generic product data extractor.
 *
 * Layered extraction strategy:
 * 1. JSON-LD / Schema.org Product (highest priority)
 * 2. OpenGraph metadata & meta tags
 * 3. HTML structured elements (specifications, ratings, prices)
 * 4. Microdata / Fallback HTML selectors
 */
export class GenericProductAdapter extends ProductSourceAdapter {
  readonly name = 'generic';
  private readonly logger = new Logger(GenericProductAdapter.name);

  canHandle(_url: string): boolean {
    return true;
  }

  async extract(url: string): Promise<RawProductData> {
    this.logger.log(`[Extract] Starting layered extraction for URL: ${url}`);
    this.validateUrl(url);

    const html = await this.fetchPage(url);
    const $ = cheerio.load(html);

    // Layer 1: JSON-LD Structured Data
    const jsonLd = this.extractJsonLd($);
    if (jsonLd.name) {
      this.logger.log(`[Extract] JSON-LD Product found: "${jsonLd.name}"`);
    }

    // Layer 2: OpenGraph metadata
    const og = this.extractOpenGraph($);

    // Layer 3: Standard Meta & Microdata
    const meta = this.extractHtmlMeta($);

    // Layer 4: HTML DOM details (prices, ratings, specs, gallery)
    const domData = this.extractDomData($, url);

    // Normalize & merge data in priority order
    const title = jsonLd.name || og.title || meta.title || domData.title || null;
    const brand = jsonLd.brand || og.brand || meta.brand || domData.brand || null;
    const category = jsonLd.category || og.category || meta.category || domData.category || null;
    const description =
      jsonLd.description || og.description || meta.description || domData.description || null;

    const priceData = this.mergePrices(jsonLd, og, meta, domData);
    const ratingData = this.mergeRatings(jsonLd, meta, domData);
    const images = this.mergeImages(jsonLd.images, og.image, meta.images, domData.images);
    const videos = this.mergeVideos(jsonLd.videos, og.video, domData.videos);
    const features = Array.from(
      new Set([...jsonLd.features, ...meta.features, ...domData.features]),
    );
    const specifications = {
      ...jsonLd.specifications,
      ...domData.specifications,
    };

    this.logger.log(
      `[Normalize] Extracted title="${title || 'N/A'}", price="${priceData.price || 'N/A'}", images=${images.length}, rating=${ratingData.rating || 'N/A'}`,
    );

    return {
      title: title ? this.cleanText(title) : null,
      brand: brand ? this.cleanText(brand) : null,
      category: category ? this.cleanText(category) : null,
      description: description ? this.cleanText(description) : null,
      price: priceData.price,
      originalPrice: priceData.originalPrice,
      currency: priceData.currency || 'VND',
      discountPercent: priceData.discountPercent,
      rating: ratingData.rating,
      reviewCount: ratingData.reviewCount,
      images,
      videos,
      features,
      specifications,
      productUrl: url,
      sourcePlatform: this.name,
    };
  }

  // ---------------------------------------------------------------------------
  // URL validation & SSRF prevention
  // ---------------------------------------------------------------------------

  private validateUrl(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error('URL không hợp lệ');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Chỉ hỗ trợ URL HTTP và HTTPS');
    }

    const hostname = parsed.hostname.toLowerCase();

    if (BLOCKED_HOSTS.includes(hostname)) {
      throw new Error('Không thể truy cập địa chỉ nội bộ');
    }

    if (BLOCKED_IP_PREFIXES.some((prefix) => hostname.startsWith(prefix))) {
      throw new Error('Không thể truy cập địa chỉ IP nội bộ');
    }
  }

  // ---------------------------------------------------------------------------
  // HTTP fetch
  // ---------------------------------------------------------------------------

  private async fetchPage(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        redirect: 'follow',
      });

      this.logger.log(`[Fetch] HTTP ${response.status} for ${url}`);

      if (!response.ok) {
        throw new Error(`Không thể tải trang sản phẩm (HTTP ${response.status})`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        throw new Error(`URL không trỏ đến trang HTML (content-type: ${contentType})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Không thể đọc nội dung trang');

      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalBytes += value.byteLength;
        if (totalBytes > MAX_RESPONSE_BYTES) {
          reader.cancel();
          throw new Error('Trang sản phẩm quá lớn (vượt quá 8MB)');
        }
        chunks.push(value);
      }

      const decoder = new TextDecoder('utf-8', { fatal: false });
      return decoder.decode(Buffer.concat(chunks));
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Hết thời gian chờ khi tải trang sản phẩm (timeout 12s)');
        }
        throw error;
      }
      throw new Error('Lỗi không xác định khi tải trang sản phẩm');
    } finally {
      clearTimeout(timeout);
    }
  }

  // ---------------------------------------------------------------------------
  // JSON-LD extraction
  // ---------------------------------------------------------------------------

  private extractJsonLd($: cheerio.CheerioAPI) {
    const result = {
      name: null as string | null,
      brand: null as string | null,
      category: null as string | null,
      description: null as string | null,
      images: [] as string[],
      videos: [] as string[],
      features: [] as string[],
      specifications: {} as Record<string, string>,
      price: null as string | null,
      originalPrice: null as string | null,
      currency: null as string | null,
      rating: null as number | null,
      reviewCount: null as number | null,
    };

    try {
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const text = $(el).html();
          if (!text) return;

          const data = JSON.parse(text);
          const items = Array.isArray(data) ? data : [data];

          for (const item of items) {
            const candidates = item['@graph'] ? [...item['@graph'], item] : [item];

            for (const candidate of candidates) {
              const type = (candidate['@type'] || '').toString().toLowerCase();
              if (
                !type.includes('product') &&
                !type.includes('offer') &&
                !type.includes('item')
              ) {
                continue;
              }

              if (!result.name && candidate.name) result.name = String(candidate.name).trim();
              if (!result.brand && candidate.brand) {
                result.brand =
                  typeof candidate.brand === 'string'
                    ? candidate.brand
                    : candidate.brand?.name || null;
              }
              if (!result.category && candidate.category) {
                result.category = String(candidate.category).trim();
              }
              if (!result.description && candidate.description) {
                result.description = String(candidate.description).trim();
              }

              // Images
              if (candidate.image) {
                const imgList = Array.isArray(candidate.image)
                  ? candidate.image
                  : [candidate.image];
                for (const img of imgList) {
                  const url = typeof img === 'string' ? img : img?.url || img?.contentUrl;
                  if (url) result.images.push(String(url));
                }
              }

              // Videos
              if (candidate.video) {
                const vidList = Array.isArray(candidate.video)
                  ? candidate.video
                  : [candidate.video];
                for (const vid of vidList) {
                  const url = typeof vid === 'string' ? vid : vid?.contentUrl || vid?.embedUrl;
                  if (url) result.videos.push(String(url));
                }
              }

              // Price from offers
              if (candidate.offers) {
                const offers = Array.isArray(candidate.offers)
                  ? candidate.offers
                  : [candidate.offers];
                for (const offer of offers) {
                  if (offer.price != null) {
                    result.price = String(offer.price);
                    if (offer.priceCurrency) result.currency = String(offer.priceCurrency);
                  }
                  if (offer.highPrice != null && !result.originalPrice) {
                    result.originalPrice = String(offer.highPrice);
                  }
                }
              }

              // AggregateRating
              if (candidate.aggregateRating) {
                const r = candidate.aggregateRating;
                if (r.ratingValue != null) result.rating = parseFloat(String(r.ratingValue));
                if (r.reviewCount != null) result.reviewCount = parseInt(String(r.reviewCount), 10);
                else if (r.ratingCount != null) result.reviewCount = parseInt(String(r.ratingCount), 10);
              }

              // Specifications
              if (candidate.additionalProperty) {
                const props = Array.isArray(candidate.additionalProperty)
                  ? candidate.additionalProperty
                  : [candidate.additionalProperty];
                for (const prop of props) {
                  if (prop.name && prop.value) {
                    result.specifications[String(prop.name)] = String(prop.value);
                    result.features.push(`${prop.name}: ${prop.value}`);
                  }
                }
              }
            }
          }
        } catch {
          // Ignore JSON-LD parse errors silently per chunk
        }
      });
    } catch (err) {
      this.logger.debug(`JSON-LD extraction warning: ${err}`);
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // OpenGraph extraction
  // ---------------------------------------------------------------------------

  private extractOpenGraph($: cheerio.CheerioAPI) {
    const ogImages: string[] = [];
    $(
      'meta[property="og:image"], meta[property="og:image:url"], meta[property="og:image:secure_url"], meta[name="twitter:image"], meta[name="image"]',
    ).each((_, el) => {
      const content = $(el).attr('content')?.trim();
      if (content) ogImages.push(content);
    });

    return {
      title: $('meta[property="og:title"]').attr('content')?.trim() || null,
      brand: $('meta[property="product:brand"]').attr('content')?.trim() || null,
      category: $('meta[property="product:category"]').attr('content')?.trim() || null,
      description: $('meta[property="og:description"]').attr('content')?.trim() || null,
      image: ogImages,
      video: $('meta[property="og:video"]').attr('content')?.trim() || null,
      price: $('meta[property="product:price:amount"]').attr('content')?.trim() || null,
      currency: $('meta[property="product:price:currency"]').attr('content')?.trim() || null,
    };
  }

  // ---------------------------------------------------------------------------
  // Standard HTML meta extraction
  // ---------------------------------------------------------------------------

  private extractHtmlMeta($: cheerio.CheerioAPI) {
    const title = $('title').first().text()?.trim() || null;
    const description = $('meta[name="description"]').attr('content')?.trim() || null;
    const brand = $('meta[name="brand"]').attr('content')?.trim() || null;
    const category = $('meta[name="category"]').attr('content')?.trim() || null;

    const images: string[] = [];
    $(
      'img[src*="product"], img[src*="item"], img[src*="gallery"], img[data-src*="product"], img[data-src*="item"]',
    ).each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
      if (src) images.push(src);
    });

    const features: string[] = [];
    $('.product-features li, .key-features li, .features-list li').each((_, el) => {
      const txt = $(el).text().trim();
      if (txt) features.push(txt);
    });

    return { title, description, brand, category, images, features };
  }

  // ---------------------------------------------------------------------------
  // HTML DOM fallbacks & Rich Gallery Extraction
  // ---------------------------------------------------------------------------

  private extractDomData($: cheerio.CheerioAPI, baseUrl?: string) {
    const title =
      $('h1.product-title, h1.product-name, h1[itemprop="name"], h1').first().text()?.trim() ||
      null;

    const description =
      $('.product-description, #product-description, [itemprop="description"]')
        .first()
        .text()
        ?.trim() || null;

    const brand =
      $('[itemprop="brand"], .product-brand, .brand-name').first().text()?.trim() || null;

    const category =
      $('.breadcrumb span, .breadcrumbs a').last().text()?.trim() || null;

    // Price selectors
    let price: string | null = null;
    let originalPrice: string | null = null;

    const currentPriceText = $(
      '.current-price, .price-current, .product-price, [itemprop="price"]',
    )
      .first()
      .text()
      ?.trim();
    if (currentPriceText) price = this.cleanPriceString(currentPriceText);

    const oldPriceText = $('.old-price, .price-old, .original-price, del')
      .first()
      .text()
      ?.trim();
    if (oldPriceText) originalPrice = this.cleanPriceString(oldPriceText);

    // Rating & Reviews
    let rating: number | null = null;
    let reviewCount: number | null = null;

    const ratingText = $('[itemprop="ratingValue"], .rating-score, .star-rating')
      .first()
      .text()
      ?.trim();
    if (ratingText) {
      const num = parseFloat(ratingText.replace(',', '.'));
      if (!isNaN(num)) rating = num;
    }

    const reviewCountText = $('[itemprop="reviewCount"], .review-count, .total-reviews')
      .first()
      .text()
      ?.trim();
    if (reviewCountText) {
      const match = reviewCountText.match(/\d+/);
      if (match) reviewCount = parseInt(match[0], 10);
    }

    // Specifications table
    const specifications: Record<string, string> = {};
    const features: string[] = [];

    $('table.specifications tr, table.product-spec tr, .spec-item').each((_, el) => {
      const key = $(el).find('td:nth-child(1), .spec-title').text().trim();
      const val = $(el).find('td:nth-child(2), .spec-value').text().trim();
      if (key && val) {
        specifications[key] = val;
        features.push(`${key}: ${val}`);
      }
    });

    const rawCandidateUrls: string[] = [];

    // 1. Target Product Gallery Elements
    const gallerySelectors = [
      '.product-gallery img',
      '.product-images img',
      '.gallery img',
      '.carousel img',
      '.slider img',
      '.swiper-slide img',
      '.slick-slide img',
      '[class*="gallery"] img',
      '[class*="carousel"] img',
      '[class*="thumb"] img',
      '[class*="product"] img',
      '[class*="image"] img',
      'img[itemprop="image"]',
      'img[data-src]',
      'img[data-lazy]',
      'img[srcset]',
      'img',
    ];

    $(gallerySelectors.join(', ')).each((_, el) => {
      const attributes = [
        $(el).attr('data-zoom-image'),
        $(el).attr('data-large_image'),
        $(el).attr('data-large-image'),
        $(el).attr('data-high-res-src'),
        $(el).attr('data-original'),
        $(el).attr('data-src'),
        $(el).attr('data-lazy-src'),
        $(el).attr('data-lazy'),
        $(el).attr('src'),
      ];

      for (const attr of attributes) {
        if (attr) rawCandidateUrls.push(attr);
      }

      // Handle srcset / data-srcset
      const srcset = $(el).attr('srcset') || $(el).attr('data-srcset');
      if (srcset) {
        const parts = srcset.split(',');
        for (const part of parts) {
          const u = part.trim().split(/\s+/)[0];
          if (u) rawCandidateUrls.push(u);
        }
      }
    });

    // 2. Inline Page Scripts (State / JSON variables & E-commerce CDNs)
    $('script').each((_, el) => {
      const scriptText = $(el).html();
      if (!scriptText || scriptText.length > 500000) return;

      // Standard image extension matches
      const stdMatches = scriptText.match(/https?:\/\/[^"'\s\\]+?\.(?:jpg|jpeg|png|webp)/gi);
      if (stdMatches) {
        for (const m of stdMatches) {
          rawCandidateUrls.push(m);
        }
      }

      // E-commerce CDN matches (Shopee, Lazada, TikTok Shop, AliExpress, etc.)
      const cdnMatches = scriptText.match(
        /https?:\/\/[^"'\s\\]*?(?:susercontent\.com\/file|ibyteimg\.com|alicdn\.com|cdnm-shopline|shopify\.com)\/[a-zA-Z0-9_\/-]+/gi,
      );
      if (cdnMatches) {
        for (const m of cdnMatches) {
          rawCandidateUrls.push(m);
        }
      }
    });

    // Resolve & Clean URLs
    const images: string[] = [];
    for (const raw of rawCandidateUrls) {
      const resolved = this.resolveAndUpgradeImageUrl(raw, baseUrl);
      if (resolved) images.push(resolved);
    }

    // Videos
    const videos: string[] = [];
    $('video source, video, iframe[src*="youtube"], iframe[src*="vimeo"]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) {
        const resolvedVid = this.resolveUrl(src, baseUrl);
        if (resolvedVid) videos.push(resolvedVid);
      }
    });

    return {
      title,
      description,
      brand,
      category,
      price,
      originalPrice,
      rating,
      reviewCount,
      specifications,
      features,
      images,
      videos,
    };
  }

  private resolveAndUpgradeImageUrl(raw: string, baseUrl?: string): string | null {
    if (!raw || typeof raw !== 'string') return null;
    let urlStr = raw.trim();
    if (urlStr.startsWith('//')) urlStr = 'https:' + urlStr;

    let absolute: string;
    try {
      if (baseUrl && !urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
        absolute = new URL(urlStr, baseUrl).href;
      } else {
        absolute = new URL(urlStr).href;
      }
    } catch {
      return null;
    }

    const lower = absolute.toLowerCase();
    if (lower.includes('data:image/') || lower.includes('.svg') || lower.endsWith('.gif')) {
      return null;
    }
    if (
      lower.includes('favicon') ||
      lower.includes('logo') ||
      lower.includes('avatar') ||
      lower.includes('icon') ||
      lower.includes('sprite') ||
      lower.includes('shopeemobile.com')
    ) {
      return null;
    }

    // Clean @resize_... parameters
    absolute = absolute.replace(/@resize_[^?#]+/i, '');

    // Upgrade known thumbnail resolutions to full resolution
    // Shopee thumbnails (_tn, _cover, _100x100, etc. with or without extension)
    absolute = absolute.replace(
      /_(tn|cover|100x100|60x60|80x80|200x200)(\.[a-z]+)?$/i,
      (_, __, g2) => g2 || '',
    );
    // Lazada thumbnails (_80x80q80.jpg)
    absolute = absolute.replace(/_\d+x\d+q\d+\.[a-z]+$/i, '');
    // Amazon thumbnails (._AC_US40_, etc.)
    absolute = absolute.replace(/\._[A-Z0-9_]+_(\.[a-z]+)?$/i, (_, g1) => g1 || '');

    return absolute;
  }

  private resolveUrl(raw: string, baseUrl?: string): string | null {
    if (!raw || typeof raw !== 'string') return null;
    let u = raw.trim();
    if (u.startsWith('//')) u = 'https:' + u;
    try {
      return baseUrl && !u.startsWith('http') ? new URL(u, baseUrl).href : new URL(u).href;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private mergePrices(
    jsonLd: any,
    og: any,
    meta: any,
    dom: any,
  ): {
    price: string | null;
    originalPrice: string | null;
    currency: string | null;
    discountPercent: number | null;
  } {
    const rawPrice = jsonLd.price || og.price || dom.price || null;
    const rawOriginalPrice = jsonLd.originalPrice || dom.originalPrice || null;
    const currency = jsonLd.currency || og.currency || 'VND';

    const pNum = rawPrice ? parseFloat(rawPrice.replace(/[^0-9.]/g, '')) : null;
    const origNum = rawOriginalPrice
      ? parseFloat(rawOriginalPrice.replace(/[^0-9.]/g, ''))
      : null;

    let discountPercent: number | null = null;
    if (pNum && origNum && origNum > pNum) {
      discountPercent = Math.round(((origNum - pNum) / origNum) * 100);
    }

    return {
      price: rawPrice ? this.cleanPriceString(rawPrice) : null,
      originalPrice: rawOriginalPrice ? this.cleanPriceString(rawOriginalPrice) : null,
      currency,
      discountPercent,
    };
  }

  private mergeRatings(jsonLd: any, meta: any, dom: any) {
    return {
      rating: jsonLd.rating ?? dom.rating ?? null,
      reviewCount: jsonLd.reviewCount ?? dom.reviewCount ?? null,
    };
  }

  private mergeImages(...lists: (string | string[] | null | undefined)[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const item of lists) {
      if (!item) continue;
      const urls = Array.isArray(item) ? item : [item];
      for (const raw of urls) {
        if (typeof raw !== 'string') continue;
        const cleaned = this.resolveAndUpgradeImageUrl(raw);
        if (cleaned && !seen.has(cleaned)) {
          seen.add(cleaned);
          result.push(cleaned);
        }
      }
    }

    return result.slice(0, 30);
  }

  private mergeVideos(...lists: (string | string[] | null | undefined)[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const item of lists) {
      if (!item) continue;
      const urls = Array.isArray(item) ? item : [item];
      for (const raw of urls) {
        if (typeof raw !== 'string') continue;
        const cleaned = raw.trim();
        if (cleaned && !seen.has(cleaned)) {
          seen.add(cleaned);
          result.push(cleaned);
        }
      }
    }

    return result.slice(0, 10);
  }

  private cleanPriceString(str: string): string {
    return str.replace(/\s+/g, ' ').trim();
  }

  private cleanText(str: string): string {
    return str
      .replace(/\s+/g, ' ')
      .replace(/[\r\n\t]+/g, ' ')
      .trim();
  }
}
