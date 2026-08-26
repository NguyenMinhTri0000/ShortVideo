import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ProductResearchService } from './product-research.service';
import { ResearchProductDto } from './dto/research-product.dto';
import type { ProductResearchResult } from './types/product-research.types';

@Controller()
export class ProductResearchController {
  private readonly logger = new Logger(ProductResearchController.name);

  constructor(
    private readonly productResearchService: ProductResearchService,
  ) {}

  @Post('products/research')
  @HttpCode(HttpStatus.OK)
  async researchProduct(
    @Body() dto: ResearchProductDto,
  ): Promise<ProductResearchResult> {
    this.logger.log(`POST /products/research for URL: ${dto.url}`);
    return this.productResearchService.researchProduct(dto.url);
  }

  @Post('product-research')
  @HttpCode(HttpStatus.OK)
  async researchProductLegacy(
    @Body() dto: ResearchProductDto,
  ): Promise<ProductResearchResult> {
    this.logger.log(`POST /product-research for URL: ${dto.url}`);
    return this.productResearchService.researchProduct(dto.url);
  }

  @Get('products/:id/research')
  async getResearchStatus(
    @Param('id') id: string,
  ): Promise<ProductResearchResult> {
    this.logger.log(`GET /products/${id}/research`);
    return this.productResearchService.getProductResearchStatus(id);
  }
}
