import { Logger } from '@nestjs/common';
import { ProductSourceAdapter } from './product-source.adapter';
import { GenericProductAdapter } from './generic-product.adapter';
import type { RawProductData } from '../types/product-research.types';

export class TikTokShopAdapter extends ProductSourceAdapter {
  readonly name = 'tiktokshop';
  private readonly logger = new Logger(TikTokShopAdapter.name);
  private readonly genericAdapter = new GenericProductAdapter();

  canHandle(url: string): boolean {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      return host.includes('tiktok.com') || host.includes('shop.tiktok.com');
    } catch {
      return false;
    }
  }

  async extract(url: string): Promise<RawProductData> {
    this.logger.log(`[TikTokShopAdapter] Extracting TikTok Shop product: ${url}`);
    const rawData = await this.genericAdapter.extract(url);
    return {
      ...rawData,
      sourcePlatform: this.name,
    };
  }
}
