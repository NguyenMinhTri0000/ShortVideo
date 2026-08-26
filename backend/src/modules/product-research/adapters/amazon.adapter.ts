import { Logger } from '@nestjs/common';
import { ProductSourceAdapter } from './product-source.adapter';
import { GenericProductAdapter } from './generic-product.adapter';
import type { RawProductData } from '../types/product-research.types';

export class AmazonAdapter extends ProductSourceAdapter {
  readonly name = 'amazon';
  private readonly logger = new Logger(AmazonAdapter.name);
  private readonly genericAdapter = new GenericProductAdapter();

  canHandle(url: string): boolean {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      return host.includes('amazon.com') || host.includes('amzn.to');
    } catch {
      return false;
    }
  }

  async extract(url: string): Promise<RawProductData> {
    this.logger.log(`[AmazonAdapter] Extracting Amazon product: ${url}`);
    const rawData = await this.genericAdapter.extract(url);
    return {
      ...rawData,
      sourcePlatform: this.name,
    };
  }
}
