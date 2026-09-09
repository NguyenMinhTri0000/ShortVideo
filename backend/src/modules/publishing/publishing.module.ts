import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '../database/database.module';
import { StorageModule } from '../storage/storage.module';
import { LlmModule } from '../llm/llm.module';
import { EncryptionService } from './encryption.service';
import { PublishingService } from './publishing.service';
import { PublishingController } from './publishing.controller';
import { PublishingProcessor } from './publishing.processor';
import { TikTokAdapter } from './adapters/tiktok.adapter';
import { YouTubeAdapter } from './adapters/youtube.adapter';
import { InstagramAdapter } from './adapters/instagram.adapter';
import { FacebookAdapter } from './adapters/facebook.adapter';

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    LlmModule,
    BullModule.registerQueue(
      { name: 'publishing-queue' },
      { name: 'analytics-queue' },
    ),
  ],
  controllers: [PublishingController],
  providers: [
    EncryptionService,
    PublishingService,
    PublishingProcessor,
    TikTokAdapter,
    YouTubeAdapter,
    InstagramAdapter,
    FacebookAdapter,
  ],
  exports: [PublishingService, EncryptionService],
})
export class PublishingModule {}
