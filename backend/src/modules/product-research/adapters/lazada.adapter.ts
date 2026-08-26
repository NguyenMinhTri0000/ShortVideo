import { Logger } from '@nestjs/common';
import { ProductSourceAdapter } from './product-source.adapter';
import { GenericProductAdapter } from './generic-product.adapter';
import type { RawProductData } from '../types/product-research.types';

export class LazadaAdapter extends ProductSourceAdapter {
  readonly name = 'lazada';
  private readonly logger = new Logger(LazadaAdapter.name);
  private readonly genericAdapter = new GenericProductAdapter();

  canHandle(url: string): boolean {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      return host.includes('lazada.vn') || host.includes('lazada.com');
    } catch {
      return false;
    }
  }

  async extract(url: string): Promise<RawProductData> {
    this.logger.log(`[LazadaAdapter] Extracting Lazada product: ${url}`);
    const rawData = await this.genericAdapter.extract(url);
    return {
      ...rawData,
      sourcePlatform: this.name,
    };
  }
}
