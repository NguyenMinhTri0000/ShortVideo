import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PublishingService } from './publishing.service';

@Processor('publishing-queue')
export class PublishingProcessor extends WorkerHost {
  private readonly logger = new Logger(PublishingProcessor.name);

  constructor(private readonly publishingService: PublishingService) {
    super();
  }

  async process(job: Job<{ jobId: string }>): Promise<any> {
    this.logger.log(`Processing BullMQ publishing job ${job.id} for publishJobId: ${job.data.jobId}`);
    await this.publishingService.executePublishJob(job.data.jobId);
  }
}
