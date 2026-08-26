import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ContentStrategyService } from './content-strategy.service';
import { ContentStrategyController } from './content-strategy.controller';
import { ContentStrategyProcessor } from './content-strategy.processor';
import { LlmModule } from '../llm/llm.module';
import { QueueModule } from '../queue/queue.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    LlmModule,
    QueueModule,
    BullModule.registerQueue({
      name: 'content-strategy',
    }),
  ],
  controllers: [ContentStrategyController],
  providers: [ContentStrategyService, ContentStrategyProcessor],
  exports: [ContentStrategyService],
})
export class ContentStrategyModule {}
