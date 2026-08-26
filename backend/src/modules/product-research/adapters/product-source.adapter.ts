import type { RawProductData } from '../types/product-research.types';

/**
 * Abstract adapter interface for product data extraction.
 *
 * Each platform (Shopee, TikTok Shop, Lazada, generic website)
 * should implement this interface so the research service can
 * select the right strategy at runtime.
 */
export abstract class ProductSourceAdapter {
  /** Human-readable name for logging */
  abstract readonly name: string;

  /**
   * Return true if this adapter can handle the given URL.
   * The research service calls `canHandle` on each registered
   * adapter in priority order and uses the first match.
   */
  abstract canHandle(url: string): boolean;

  /**
   * Fetch the product page and extract structured data.
   * Must never throw unrecoverable errors — return partial data
   * with null fields instead.
   */
  abstract extract(url: string): Promise<RawProductData>;
}
