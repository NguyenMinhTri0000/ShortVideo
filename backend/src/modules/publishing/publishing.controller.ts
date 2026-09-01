import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { PublishingService, CreateAccountDto, CreatePublishJobDto } from './publishing.service';
import { PlatformType } from './adapters/platform-adapter.interface';

@Controller('publishing')
export class PublishingController {
  constructor(private readonly publishingService: PublishingService) {}

  // --- ACCOUNTS ---

  @Get('accounts')
  async getAccounts() {
    return this.publishingService.getAccounts();
  }

  @Post('accounts')
  async createAccount(@Body() dto: CreateAccountDto) {
    return this.publishingService.createAccount(dto);
  }

  @Delete('accounts/:id')
  async deleteAccount(@Param('id') id: string) {
    return this.publishingService.deleteAccount(id);
  }

  @Get('accounts/:platform/connect')
  async getConnectUrl(
    @Param('platform') platform: string,
    @Query('redirectUri') redirectUri: string,
  ) {
    const plat = platform.toUpperCase() as PlatformType;
    const baseUrl = process.env.OAUTH_REDIRECT_BASE_URL || process.env.CORS_ORIGIN || 'http://localhost:23000';
    const defaultRedirect = `${baseUrl}/api/publishing/accounts/${platform.toLowerCase()}/callback`;
    return this.publishingService.getOAuthUrl(plat, redirectUri || defaultRedirect);
  }

  @Get('accounts/:platform/callback')
  async handleCallback(
    @Param('platform') platform: string,
    @Query('code') code: string,
    @Query('redirectUri') redirectUri: string,
    @Res() res: Response,
  ) {
    try {
      const plat = platform.toUpperCase() as PlatformType;
      const baseUrl = process.env.OAUTH_REDIRECT_BASE_URL || process.env.CORS_ORIGIN || 'http://localhost:23000';
      const defaultRedirect = `${baseUrl}/api/publishing/accounts/${platform.toLowerCase()}/callback`;
      const account = await this.publishingService.handleOAuthCallback(
        plat,
        code,
        redirectUri || defaultRedirect,
      );
      return res.redirect(`http://localhost:23000/publishing?accountConnected=${account.id}`);
    } catch (err: any) {
      const errorMessage = encodeURIComponent(err.message || 'OAuth authorization failed.');
      return res.redirect(`http://localhost:23000/publishing?error=${errorMessage}`);
    }
  }

  // --- PUBLISHING JOBS ---

  @Post('jobs')
  async createJob(@Body() dto: CreatePublishJobDto) {
    return this.publishingService.createJob(dto);
  }

  @Get('jobs')
  async listJobs(
    @Query('platform') platform?: string,
    @Query('status') status?: string,
    @Query('videoId') videoId?: string,
  ) {
    return this.publishingService.listJobs({ platform, status, videoId });
  }

  @Get('jobs/:id')
  async getJobById(@Param('id') id: string) {
    return this.publishingService.getJobById(id);
  }

  @Post('jobs/:id/retry')
  @HttpCode(HttpStatus.OK)
  async retryJob(@Param('id') id: string) {
    return this.publishingService.retryJob(id);
  }

  @Post('jobs/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelJob(@Param('id') id: string) {
    return this.publishingService.cancelJob(id);
  }
}
