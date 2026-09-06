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
import {
  PublishingService,
  CreateAccountDto,
  CreatePublishJobDto,
  CreateBatchPublishJobsDto,
} from './publishing.service';
import { PlatformType } from './adapters/platform-adapter.interface';

@Controller('publishing')
export class PublishingController {
  constructor(private readonly publishingService: PublishingService) {}

  // --- ACCOUNTS ---

  @Get('config-status')
  @Get('accounts/config-status')
  async getConfigStatus() {
    return this.publishingService.getConfigStatus();
  }

  @Get('debug/:platform')
  async getPlatformDebugInfo(@Param('platform') platform: string) {
    const plat = platform.toUpperCase() as PlatformType;
    const adapter = this.publishingService.getAdapter(plat);
    const redirectUri = this.getDefaultRedirect(platform);
    const missingConfig = adapter.getMissingConfig
      ? adapter.getMissingConfig()
      : [];

    let oauthAuthUrl: string | null = null;
    let authUrlError: string | null = null;

    if (adapter.isConfigured() && adapter.getAuthUrl) {
      try {
        const res = adapter.getAuthUrl(redirectUri);
        oauthAuthUrl = res.url;
      } catch (err: any) {
        authUrlError = err.message || 'Error generating auth URL';
      }
    }

    return {
      platform: plat,
      isConfigured: adapter.isConfigured(),
      missingConfig,
      redirectUri,
      oauthAuthUrlGenerated: Boolean(oauthAuthUrl),
      authUrlError,
      environmentCheck: {
        oauthRedirectBaseUrl: process.env.OAUTH_REDIRECT_BASE_URL || null,
        frontendUrl: process.env.FRONTEND_URL || null,
      },
    };
  }

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

  private getDefaultRedirect(platform: string): string {
    const envKey = `${platform.toUpperCase()}_REDIRECT_URI`;
    if (process.env[envKey]) {
      return process.env[envKey];
    }
    const baseUrl =
      process.env.OAUTH_REDIRECT_BASE_URL ||
      process.env.CORS_ORIGIN ||
      'http://localhost:23000';
    return `${baseUrl}/api/publishing/accounts/${platform.toLowerCase()}/callback`;
  }

  @Get('accounts/:platform/connect')
  async getConnectUrl(
    @Param('platform') platform: string,
    @Query('redirectUri') redirectUri: string,
  ) {
    const plat = platform.toUpperCase() as PlatformType;
    const defaultRedirect = this.getDefaultRedirect(platform);
    return this.publishingService.getOAuthUrl(
      plat,
      redirectUri || defaultRedirect,
    );
  }

  @Get('accounts/:platform/callback')
  async handleCallback(
    @Param('platform') platform: string,
    @Query('code') code: string,
    @Query('redirectUri') redirectUri: string,
    @Res() res: Response,
  ) {
    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.CORS_ORIGIN ||
      'http://localhost:23000';
    try {
      const plat = platform.toUpperCase() as PlatformType;
      const defaultRedirect = this.getDefaultRedirect(platform);
      const account = await this.publishingService.handleOAuthCallback(
        plat,
        code,
        redirectUri || defaultRedirect,
      );
      return res.redirect(
        `${frontendUrl}/publishing?accountConnected=${account.id}`,
      );
    } catch (err: any) {
      const errorMessage = encodeURIComponent(
        err.message || 'OAuth authorization failed.',
      );
      return res.redirect(`${frontendUrl}/publishing?error=${errorMessage}`);
    }
  }

  // --- PUBLISHING JOBS ---

  @Post('jobs')
  async createJob(@Body() dto: CreatePublishJobDto) {
    return this.publishingService.createJob(dto);
  }

  @Post('jobs/batch')
  async createBatchJobs(@Body() dto: CreateBatchPublishJobsDto) {
    return this.publishingService.createBatchJobs(dto);
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
