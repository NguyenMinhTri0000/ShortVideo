import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ContentStrategyService } from './content-strategy.service';
import type { ContentStrategyJobPayload } from './types/content-idea.types';

@Processor('content-strategy', { concurrency: 2 })
export class ContentStrategyProcessor extends WorkerHost {
  private readonly logger = new Logger(ContentStrategyProcessor.name);

  constructor(
    private readonly contentStrategyService: ContentStrategyService,
  ) {
    super();
  }

  async process(job: Job<ContentStrategyJobPayload>): Promise<unknown> {
    const { productId } = job.data;
    this.logger.log(
      `[Worker] Processing content strategy job ${job.id} for productId=${productId}`,
    );

    try {
      const ideas =
        await this.contentStrategyService.executeStrategyPipeline(productId);
      this.logger.log(
        `[Worker] Content strategy job ${job.id} finished with ${ideas.length} ideas generated`,
      );
      return { count: ideas.length, ideas };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Worker] Content strategy job ${job.id} failed: ${msg}`);
      throw error;
    }
  }
}
