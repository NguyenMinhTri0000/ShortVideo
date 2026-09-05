import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ProductResearchController } from './product-research.controller';
import { ProductResearchService } from './product-research.service';
import { ProductAnalysisService } from './product-analysis.service';
import { ContentBriefService } from './content-brief.service';
import { ProductResearchProcessor } from './product-research.processor';
import { LlmModule } from '../llm/llm.module';
import { DatabaseModule } from '../database/database.module';

import { AssetDiscoveryService } from './asset-discovery.service';
import { UrlResolverService } from './url-resolver.service';

@Module({
  imports: [
    DatabaseModule,
    LlmModule,
    BullModule.registerQueue({
      name: 'product-research',
    }),
  ],
  controllers: [ProductResearchController],
  providers: [
    ProductResearchService,
    ProductAnalysisService,
    ContentBriefService,
    ProductResearchProcessor,
    AssetDiscoveryService,
    UrlResolverService,
  ],
  exports: [
    ProductResearchService,
    ProductAnalysisService,
    ContentBriefService,
    AssetDiscoveryService,
    UrlResolverService,
  ],
})
export class ProductResearchModule {}
