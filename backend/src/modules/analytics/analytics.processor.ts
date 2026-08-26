import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AnalyticsService } from './analytics.service';

@Processor('analytics-queue')
export class AnalyticsProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  constructor(private readonly analyticsService: AnalyticsService) {
    super();
  }

  async process(job: Job<{ publishJobId: string; intervalLabel?: string }>): Promise<any> {
    const { publishJobId, intervalLabel } = job.data;
    this.logger.log(`Processing analytics collection job ${job.id} for publishJobId: ${publishJobId} (Interval: ${intervalLabel || 'on-demand'})`);

    await this.analyticsService.collectSnapshotForJob(publishJobId);

    if (intervalLabel) {
      await this.analyticsService.scheduleNextSnapshot(publishJobId, intervalLabel);
    }
  }
}
