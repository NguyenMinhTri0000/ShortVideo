import { Logger } from '@nestjs/common';
import { ProductSourceAdapter } from './product-source.adapter';
import { GenericProductAdapter } from './generic-product.adapter';
import type { RawProductData } from '../types/product-research.types';

/**
 * Shopee Platform Adapter
 *
 * Dedicated adapter for Shopee URLs (`shopee.vn`, `shopee.com.*`, `shp.ee`).
 * Uses Shopee-specific DOM fallback selectors and JSON-LD structure,
 * delegating generic fetching logic to `GenericProductAdapter`.
 */
export class ShopeeAdapter extends ProductSourceAdapter {
  readonly name = 'shopee';
  private readonly logger = new Logger(ShopeeAdapter.name);
  private readonly genericAdapter = new GenericProductAdapter();

  canHandle(url: string): boolean {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      return (
        host === 'shopee.vn' ||
        host.endsWith('.shopee.vn') ||
        host === 'shopee.com' ||
        host.endsWith('.shopee.com') ||
        host === 'shp.ee' ||
        host.endsWith('.shp.ee')
      );
    } catch {
      return false;
    }
  }

  async extract(url: string): Promise<RawProductData> {
    this.logger.log(`[ShopeeAdapter] Extracting Shopee product: ${url}`);

    const rawData = await this.genericAdapter.extract(url);

    // Clean Shopee image URLs (remove SVG icons, @resize_... and thumbnail suffixes)
    const shopeeImages: string[] = [];
    for (const rawImg of rawData.images || []) {
      if (
        !rawImg ||
        rawImg.endsWith('.svg') ||
        rawImg.includes('shopeemobile.com')
      ) {
        continue;
      }
      const cleanImg = rawImg
        .replace(/@resize_[^?#]+/i, '')
        .replace(/_(tn|cover|100x100|60x60|80x80|200x200)$/i, '');
      if (cleanImg && !shopeeImages.includes(cleanImg)) {
        shopeeImages.push(cleanImg);
      }
    }

    return {
      ...rawData,
      images: shopeeImages.length > 0 ? shopeeImages : rawData.images,
      sourcePlatform: this.name,
      brand:
        rawData.brand && rawData.brand !== 'Shopee Seller'
          ? rawData.brand
          : 'Shopee Seller',
    };
  }
}
