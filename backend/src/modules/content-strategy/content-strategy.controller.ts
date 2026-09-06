import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { ContentStrategyService } from './content-strategy.service';
import type { VideoJobConfig } from '../queue/queue.service';

@Controller()
export class ContentStrategyController {
  constructor(
    private readonly contentStrategyService: ContentStrategyService,
  ) {}

  @Post('products/:id/content-ideas/generate')
  generateContentIdeas(@Param('id') productId: string) {
    return this.contentStrategyService.generateContentIdeas(productId);
  }

  @Get('products/:id/content-ideas')
  getContentIdeasByProduct(@Param('id') productId: string) {
    return this.contentStrategyService.getContentIdeasByProduct(productId);
  }

  @Get('content-ideas/:id')
  getContentIdeaById(@Param('id') id: string) {
    return this.contentStrategyService.getContentIdeaById(id);
  }

  @Delete('content-ideas/:id')
  deleteContentIdea(@Param('id') id: string) {
    return this.contentStrategyService.deleteContentIdea(id);
  }

  @Post('content-ideas/:id/generate-video')
  generateVideoFromIdea(
    @Param('id') id: string,
    @Body() config: VideoJobConfig = {},
  ) {
    return this.contentStrategyService.generateVideoFromIdea(id, config);
  }

  @Post('products/:id/content-ideas/batch-generate-videos')
  batchGenerateVideos(
    @Param('id') productId: string,
    @Body()
    body: { ideaIds?: string[]; limit?: number; config?: VideoJobConfig } = {},
  ) {
    return this.contentStrategyService.batchGenerateVideosFromIdeas(
      productId,
      body.ideaIds,
      body.config || {},
      body.limit || 3,
    );
  }
}
