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

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Generic product data extractor.
 *
 * Extracts product information from any website by parsing:
 * 1. JSON-LD structured data  (highest priority)
 * 2. OpenGraph metadata
 * 3. Standard HTML metadata
 * 4. Common price patterns
 */
export class GenericProductAdapter extends ProductSourceAdapter {
  readonly name = 'generic';
  private readonly logger = new Logger(GenericProductAdapter.name);

  canHandle(_url: string): boolean {
    // Generic adapter is the fallback — it handles any valid HTTP(S) URL
    return true;
  }

  async extract(url: string): Promise<RawProductData> {
    this.validateUrl(url);

    const html = await this.fetchPage(url);
    const $ = cheerio.load(html);

    // Extract from multiple sources and merge
    const jsonLd = this.extractJsonLd($);
    const og = this.extractOpenGraph($);
    const meta = this.extractHtmlMeta($);
    const priceData = this.extractPrice($, jsonLd);

    // Merge with priority: JSON-LD > OG > HTML meta
    const title = jsonLd.name || og.title || meta.title || null;
    const description =
      jsonLd.description || og.description || meta.description || null;
    const images = this.mergeImages(jsonLd.images, og.image, meta.images);

    return {
      title,
      description,
      price: priceData.price,
      currency: priceData.currency,
      images,
      features: jsonLd.features || [],
      productUrl: url,
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
  // HTTP fetch with timeout & size limit
  // ---------------------------------------------------------------------------

  private async fetchPage(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        throw new Error(
          `Không thể tải trang sản phẩm (HTTP ${response.status})`,
        );
      }

      const contentType = response.headers.get('content-type') || '';
      if (
        !contentType.includes('text/html') &&
        !contentType.includes('application/xhtml')
      ) {
        throw new Error(
          'URL không trỏ đến trang HTML (content-type: ' + contentType + ')',
        );
      }

      // Read with size limit
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Không thể đọc nội dung trang');
      }

      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalBytes += value.byteLength;
        if (totalBytes > MAX_RESPONSE_BYTES) {
          reader.cancel();
          throw new Error(
            'Trang sản phẩm quá lớn (vượt quá 5MB)',
          );
        }
        chunks.push(value);
      }

      const decoder = new TextDecoder('utf-8', { fatal: false });
      return decoder.decode(Buffer.concat(chunks));
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(
            'Hết thời gian chờ khi tải trang sản phẩm (timeout 10s)',
          );
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

  private extractJsonLd($: cheerio.CheerioAPI): {
    name: string | null;
    description: string | null;
    images: string[];
    features: string[];
    price: string | null;
    currency: string | null;
  } {
    const result = {
      name: null as string | null,
      description: null as string | null,
      images: [] as string[],
      features: [] as string[],
      price: null as string | null,
      currency: null as string | null,
    };

    try {
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const text = $(el).html();
          if (!text) return;

          const data = JSON.parse(text);
          const items = Array.isArray(data) ? data : [data];

          for (const item of items) {
            // Handle @graph arrays
            const candidates = item['@graph']
              ? [...item['@graph'], item]
              : [item];

            for (const candidate of candidates) {
              const type = (candidate['@type'] || '').toString().toLowerCase();
              if (
                !type.includes('product') &&
                !type.includes('offer') &&
                !type.includes('item')
              ) {
                continue;
              }

              if (!result.name && candidate.name) {
                result.name = String(candidate.name).trim();
              }
              if (!result.description && candidate.description) {
                result.description = String(candidate.description).trim();
              }

              // Images
              const imgField = candidate.image;
              if (imgField) {
                if (typeof imgField === 'string') {
                  result.images.push(imgField);
                } else if (Array.isArray(imgField)) {
                  for (const img of imgField) {
                    const url =
                      typeof img === 'string'
                        ? img
                        : img?.url || img?.contentUrl;
                    if (url) result.images.push(String(url));
                  }
                } else if (imgField?.url || imgField?.contentUrl) {
                  result.images.push(
                    String(imgField.url || imgField.contentUrl),
                  );
                }
              }

              // Price from offers
              const offers = candidate.offers;
              if (offers && !result.price) {
                const offerList = Array.isArray(offers) ? offers : [offers];
                for (const offer of offerList) {
                  const p =
                    offer.price || offer.lowPrice || offer.highPrice;
                  if (p != null) {
                    result.price = String(p);
                    if (offer.priceCurrency) {
                      result.currency = String(offer.priceCurrency);
                    }
                    break;
                  }
                }
              }

              // Direct price
              if (!result.price && candidate.price != null) {
                result.price = String(candidate.price);
                if (candidate.priceCurrency) {
                  result.currency = String(candidate.priceCurrency);
                }
              }

              // Features
              if (candidate.additionalProperty) {
                const props = Array.isArray(candidate.additionalProperty)
                  ? candidate.additionalProperty
                  : [candidate.additionalProperty];
                for (const prop of props) {
                  if (prop.name && prop.value) {
                    result.features.push(`${prop.name}: ${prop.value}`);
                  }
                }
              }
            }
          }
        } catch (parseErr) {
          this.logger.debug(
            `Failed to parse a JSON-LD block: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
          );
        }
      });
    } catch (err) {
      this.logger.debug(
        `JSON-LD extraction failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // OpenGraph extraction
  // ---------------------------------------------------------------------------

  private extractOpenGraph($: cheerio.CheerioAPI): {
    title: string | null;
    description: string | null;
    image: string | null;
  } {
    const ogTitle =
      $('meta[property="og:title"]').attr('content')?.trim() || null;
    const ogDescription =
      $('meta[property="og:description"]').attr('content')?.trim() || null;
    const ogImage =
      $('meta[property="og:image"]').attr('content')?.trim() || null;

    return {
      title: ogTitle,
      description: ogDescription,
      image: ogImage,
    };
  }

  // ---------------------------------------------------------------------------
  // Standard HTML meta extraction
  // ---------------------------------------------------------------------------

  private extractHtmlMeta($: cheerio.CheerioAPI): {
    title: string | null;
    description: string | null;
    images: string[];
  } {
    const title = $('title').first().text()?.trim() || null;
    const description =
      $('meta[name="description"]').attr('content')?.trim() || null;

    // Collect product-looking images from the page
    const images: string[] = [];
    $(
      'img[src*="product"], img[src*="item"], img[data-src*="product"], img[data-src*="item"]',
    ).each((_, el) => {
      const src =
        $(el).attr('src') || $(el).attr('data-src');
      if (src && src.startsWith('http')) {
        images.push(src);
      }
    });

    // Also collect large images (likely product photos)
    if (images.length === 0) {
      $('img[src^="http"]').each((_, el) => {
        const src = $(el).attr('src');
        const width = parseInt($(el).attr('width') || '0', 10);
        const height = parseInt($(el).attr('height') || '0', 10);
        if (src && (width >= 200 || height >= 200 || (!width && !height))) {
          images.push(src);
        }
      });
    }

    return { title, description, images: images.slice(0, 10) };
  }

  // ---------------------------------------------------------------------------
  // Price extraction helpers
  // ---------------------------------------------------------------------------

  private extractPrice(
    $: cheerio.CheerioAPI,
    jsonLd: { price: string | null; currency: string | null },
  ): { price: string | null; currency: string | null } {
    // Prefer JSON-LD price
    if (jsonLd.price) {
      return { price: jsonLd.price, currency: jsonLd.currency };
    }

    // Try meta tags
    const metaPrice =
      $('meta[property="product:price:amount"]').attr('content') ||
      $('meta[itemprop="price"]').attr('content') ||
      $('[itemprop="price"]').attr('content');

    const metaCurrency =
      $('meta[property="product:price:currency"]').attr('content') ||
      $('meta[itemprop="priceCurrency"]').attr('content') ||
      $('[itemprop="priceCurrency"]').attr('content') ||
      $('[itemprop="priceCurrency"]').text()?.trim();

    if (metaPrice) {
      return {
        price: metaPrice.trim(),
        currency: metaCurrency?.trim() || null,
      };
    }

    return { price: null, currency: null };
  }

  // ---------------------------------------------------------------------------
  // Image merging & dedup
  // ---------------------------------------------------------------------------

  private mergeImages(
    jsonLdImages: string[],
    ogImage: string | null,
    htmlImages: string[],
  ): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    const add = (url: string) => {
      const normalized = url.trim();
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        result.push(normalized);
      }
    };

    // Priority: JSON-LD > OG > HTML
    for (const img of jsonLdImages) add(img);
    if (ogImage) add(ogImage);
    for (const img of htmlImages) add(img);

    return result.slice(0, 15); // Cap at 15 images
  }
}
