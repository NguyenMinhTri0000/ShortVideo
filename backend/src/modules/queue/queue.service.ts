import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { cancelledJobs, killActiveProcess } from './video.processor';

export type VideoJobConfig = {
  voice_name?: string;
  aspect_ratio?: string;
  video_source?: string;
  video_concat_mode?: string;
  bgm_type?: string;
  bgm_file?: string;
  bgm_volume?: number;
  subtitle_enabled?: boolean;
  subtitle_position?: string;
  font_name?: string;
  font_size?: number;
  stroke_color?: string;
  stroke_width?: number;
  productId?: string;
};

export type VideoJobPayload = {
  jobId: string;
  ideaId: string;
  subject: string;
  script?: string;
  language: string;
  config: VideoJobConfig;
  productId?: string;
};

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('video-generation')
    private videoQueue: Queue<VideoJobPayload>,
  ) {}

  async addVideoJob(
    jobId: string,
    ideaId: string,
    subject: string,
    script: string | undefined,
    language: string,
    config: VideoJobConfig,
  ) {
    return this.videoQueue.add(
      'generate-video',
      {
        jobId,
        ideaId,
        subject,
        script,
        language,
        config,
      },
      {
        jobId,
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  async getJobStatus(jobId: string) {
    const job = await this.videoQueue.getJob(jobId);
    if (!job) return null;
    return await job.getState();
  }

  async cancelJob(jobId: string) {
    cancelledJobs.add(jobId);
    killActiveProcess(jobId);

    try {
      const job = await this.videoQueue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        if (state === 'active') {
          await job.discard();
        } else {
          await job.remove();
        }
        return true;
      }
    } catch {
      // Ignore if BullMQ state mutation fails
    }
    return false;
  }
}
