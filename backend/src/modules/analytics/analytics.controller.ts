import { Controller, Get, Post, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { AnalyticsService, AnalyticsFilterDto } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  async getOverview(
    @Query('platform') platform?: string,
    @Query('videoId') videoId?: string,
    @Query('dateRange') dateRange?: 'today' | 'last7days' | 'last30days' | 'last90days' | 'custom',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getOverview({
      platform,
      videoId,
      dateRange,
      startDate,
      endDate,
    });
  }

  @Get('top-performing')
  async getTopPerforming(
    @Query('platform') platform?: string,
    @Query('videoId') videoId?: string,
    @Query('dateRange') dateRange?: 'today' | 'last7days' | 'last30days' | 'last90days' | 'custom',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sortBy') sortBy?: 'views' | 'likes' | 'comments' | 'shares' | 'engagementRate',
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.getTopPerforming({
      platform,
      videoId,
      dateRange,
      startDate,
      endDate,
      sortBy,
      limit: limit ? Number(limit) : 10,
    });
  }

  @Get('platforms/:platform')
  async getPlatformAnalytics(
    @Param('platform') platform: string,
    @Query('dateRange') dateRange?: 'today' | 'last7days' | 'last30days' | 'last90days' | 'custom',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getOverview({
      platform: platform.toUpperCase(),
      dateRange,
      startDate,
      endDate,
    });
  }

  @Get('videos/:videoId')
  async getVideoAnalytics(@Param('videoId') videoId: string) {
    return this.analyticsService.getVideoAnalytics(videoId);
  }

  @Get('posts/:postId')
  async getPostAnalytics(@Param('postId') postId: string) {
    return this.analyticsService.getPostAnalytics(postId);
  }

  @Post('collect/:jobId')
  @HttpCode(HttpStatus.OK)
  async triggerCollection(@Param('jobId') jobId: string) {
    await this.analyticsService.collectSnapshotForJob(jobId);
    return { success: true, message: `Collected analytics snapshot for publish job ${jobId}` };
  }
}
