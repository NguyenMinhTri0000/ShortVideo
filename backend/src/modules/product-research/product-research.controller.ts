import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ProductResearchService } from './product-research.service';
import { ResearchProductDto } from './dto/research-product.dto';
import type { ProductResearchResult } from './types/product-research.types';

@Controller('product-research')
export class ProductResearchController {
  private readonly logger = new Logger(ProductResearchController.name);

  constructor(
    private readonly productResearchService: ProductResearchService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async researchProduct(
    @Body() dto: ResearchProductDto,
  ): Promise<ProductResearchResult> {
    this.logger.log(`Product research request for URL: ${dto.url}`);
    return this.productResearchService.researchProduct(dto.url);
  }
}
