import { Module } from '@nestjs/common';
import { ProductResearchService } from './product-research.service';
import { ProductResearchController } from './product-research.controller';

@Module({
  controllers: [ProductResearchController],
  providers: [ProductResearchService],
  exports: [ProductResearchService],
})
export class ProductResearchModule {}
