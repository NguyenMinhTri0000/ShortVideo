import { Module } from '@nestjs/common';
import { ScriptEngineService } from './script-engine.service';
import { ScriptEngineController } from './script-engine.controller';
import { DatabaseModule } from '../database/database.module';
import { LlmModule } from '../llm/llm.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [DatabaseModule, LlmModule, QueueModule],
  controllers: [ScriptEngineController],
  providers: [ScriptEngineService],
  exports: [ScriptEngineService],
})
export class ScriptEngineModule {}
