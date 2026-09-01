import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { VideoProcessor } from './video.processor';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'video-generation',
    }),
    SettingsModule,
  ],
  providers: [QueueService, VideoProcessor],
  exports: [QueueService],
})
export class QueueModule {}
