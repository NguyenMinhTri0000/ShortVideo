import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ProductResearchService } from './product-research.service';

export interface ProductResearchJobPayload {
  productId: string;
  url: string;
}

@Processor('product-research', { concurrency: 2 })
export class ProductResearchProcessor extends WorkerHost {
  private readonly logger = new Logger(ProductResearchProcessor.name);

  constructor(
    private readonly productResearchService: ProductResearchService,
  ) {
    super();
  }

  async process(job: Job<ProductResearchJobPayload>): Promise<unknown> {
    const { productId, url } = job.data;
    this.logger.log(
      `[Worker] Processing product research job ${job.id} for productId=${productId}, url=${url}`,
    );

    try {
      const result = await this.productResearchService.executeResearchPipeline(
        productId,
        url,
      );
      this.logger.log(
        `[Worker] Research job ${job.id} finished with status=${result.product?.researchStatus}`,
      );
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Worker] Job ${job.id} failed: ${msg}`);
      throw error;
    }
  }
}
