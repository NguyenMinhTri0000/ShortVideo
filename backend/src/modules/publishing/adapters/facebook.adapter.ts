import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformAccount } from '@prisma/client';
import axios from 'axios';
import {
  PlatformAdapter,
  PlatformType,
  PublishParams,
  PublishResult,
  PlatformMetrics,
  OAuthAuthUrlResult,
  OAuthTokenResult,
} from './platform-adapter.interface';
import { EncryptionService } from '../encryption.service';

@Injectable()
export class FacebookAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'FACEBOOK';
  private readonly logger = new Logger(FacebookAdapter.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
  ) {}

  getMissingConfig(): string[] {
    const missing: string[] = [];
    const appId = (
      this.configService.get<string>('FACEBOOK_CLIENT_ID') ||
      this.configService.get<string>('FACEBOOK_APP_ID') ||
      ''
    ).trim();
    const appSecret = (
      this.configService.get<string>('FACEBOOK_CLIENT_SECRET') ||
      this.configService.get<string>('FACEBOOK_APP_SECRET') ||
      ''
    ).trim();

    if (!appId) missing.push('FACEBOOK_APP_ID');
    if (!appSecret) missing.push('FACEBOOK_APP_SECRET');

    return missing;
  }

  isConfigured(): boolean {
    return this.getMissingConfig().length === 0;
  }

  getAuthUrl(redirectUri: string, state = 'facebook_auth'): OAuthAuthUrlResult {
    const appId =
      this.configService.get<string>('FACEBOOK_CLIENT_ID') ||
      this.configService.get<string>('FACEBOOK_APP_ID') ||
      '';
    const scope = 'pages_show_list,pages_read_engagement,pages_manage_posts,publish_video';
    const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&response_type=code&state=${encodeURIComponent(state)}`;
    return { url, state };
  }

  async handleCallback(code: string, redirectUri: string): Promise<OAuthTokenResult> {
    const appId =
      this.configService.get<string>('FACEBOOK_CLIENT_ID') ||
      this.configService.get<string>('FACEBOOK_APP_ID') ||
      '';
    const appSecret =
      this.configService.get<string>('FACEBOOK_CLIENT_SECRET') ||
      this.configService.get<string>('FACEBOOK_APP_SECRET') ||
      '';

    if (!appId || !appSecret) {
      throw new Error('Facebook app ID or secret is not configured.');
    }

    try {
      const tokenRes = await axios.get(
        `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`,
      );

      const userToken = tokenRes.data.access_token;
      const expiresIn = tokenRes.data.expires_in || 5184000;

      // Get Page Access Token from Graph API
      const pagesRes = await axios.get(
        `https://graph.facebook.com/v19.0/me/accounts?access_token=${userToken}`,
      );

      const pages = pagesRes.data?.data;
      if (!Array.isArray(pages) || pages.length === 0) {
        throw new Error(
          'Facebook authorization succeeded, but no Facebook Page was found for this user account. A Facebook Page is required to publish Facebook Reels.',
        );
      }

      const page = pages[0];
      const accountId = page.id;
      const accountName = page.name || 'Facebook Page';
      const pageAccessToken = page.access_token || userToken;

      if (!accountId || accountId === 'facebook_page') {
        throw new Error('Could not resolve valid Facebook Page ID from user accounts.');
      }

      return {
        accessToken: pageAccessToken,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        accountId,
        accountName,
      };
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        const metaErr = err.response.data.error;
        this.logger.error(`Facebook OAuth error: ${JSON.stringify(metaErr)}`);
        throw new Error(`Facebook OAuth token exchange failed: ${metaErr.message || JSON.stringify(metaErr)}`);
      }
      throw err;
    }
  }

  async publish(account: PlatformAccount, params: PublishParams): Promise<PublishResult> {
    const decryptedToken = this.encryptionService.decrypt(account.accessToken);

    if (!this.isConfigured() || !decryptedToken || !account.accountId) {
      this.logger.warn(`Facebook Reels publishing failed: Adapter not fully configured or missing page token/ID for account ${account.id}`);
      return {
        success: false,
        errorCode: 'NOT_CONFIGURED',
        errorMessage: 'Facebook Reels API is not fully configured with Graph API app credentials or connected Page account.',
      };
    }

    try {
      const description = params.description || params.caption || params.title || '';

      // Step 1: Start upload phase for Facebook Video Reel
      const startRes = await axios.post(
        `https://graph.facebook.com/v19.0/${account.accountId}/video_reels`,
        {
          upload_phase: 'start',
          access_token: decryptedToken,
        },
      );

      const videoId = startRes.data?.video_id;
      const uploadUrl = startRes.data?.upload_url;

      if (!videoId) {
        return {
          success: false,
          errorCode: 'REEL_START_FAILED',
          errorMessage: 'Facebook Graph API did not initialize Reel upload session.',
          rawResponse: startRes.data,
        };
      }

      // Step 2: Upload file / URL
      if (uploadUrl && params.videoBuffer) {
        await axios.post(uploadUrl, params.videoBuffer, {
          headers: {
            Authorization: `OAuth ${decryptedToken}`,
            'file_url': params.downloadUrl,
          },
        });
      }

      // Step 3: Finish upload phase
      const finishRes = await axios.post(
        `https://graph.facebook.com/v19.0/${account.accountId}/video_reels`,
        {
          upload_phase: 'finish',
          video_id: videoId,
          video_state: 'PUBLISHED',
          description,
          access_token: decryptedToken,
        },
      );

      return {
        success: Boolean(finishRes.data?.success || videoId),
        platformPostId: videoId,
        platformUrl: `https://www.facebook.com/reel/${videoId}`,
        publishedAt: new Date(),
        rawResponse: finishRes.data,
      };
    } catch (error: any) {
      this.logger.error(`Facebook Reels publish request failed: ${error.message}`, error.stack);
      return {
        success: false,
        errorCode: error.response?.data?.error?.code || 'FACEBOOK_API_ERROR',
        errorMessage: error.response?.data?.error?.message || error.message || 'Error executing Facebook API request.',
        rawResponse: error.response?.data,
      };
    }
  }

  async getPostStatus(account: PlatformAccount, platformPostId: string): Promise<PublishResult> {
    const decryptedToken = this.encryptionService.decrypt(account.accessToken);
    if (!decryptedToken) {
      return { success: false, errorCode: 'NOT_CONFIGURED', errorMessage: 'Missing access token.' };
    }

    try {
      const response = await axios.get(
        `https://graph.facebook.com/v19.0/${platformPostId}?fields=id,status&access_token=${decryptedToken}`,
      );

      return {
        success: Boolean(response.data?.id),
        platformPostId: response.data?.id || platformPostId,
        platformUrl: `https://www.facebook.com/reel/${platformPostId}`,
        rawResponse: response.data,
      };
    } catch (error: any) {
      return { success: false, errorCode: 'STATUS_CHECK_FAILED', errorMessage: error.message };
    }
  }

  async fetchAnalytics(account: PlatformAccount, platformPostId: string): Promise<PlatformMetrics> {
    const decryptedToken = this.encryptionService.decrypt(account.accessToken);
    if (!decryptedToken) {
      return { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0 };
    }

    try {
      const response = await axios.get(
        `https://graph.facebook.com/v19.0/${platformPostId}?fields=views,likes.summary(true),comments.summary(true),shares&access_token=${decryptedToken}`,
      );

      const data = response.data || {};
      const views = Number(data.views || 0);
      const likes = Number(data.likes?.summary?.total_count || 0);
      const comments = Number(data.comments?.summary?.total_count || 0);
      const shares = Number(data.shares?.count || 0);
      const engagementRate = views > 0 ? (likes + comments + shares) / views : 0;

      return {
        views,
        likes,
        comments,
        shares,
        saves: 0,
        clicks: 0,
        engagementRate,
        rawMetadata: data,
      };
    } catch (error) {
      this.logger.warn(`Failed to fetch Facebook analytics for post ${platformPostId}: ${(error as Error).message}`);
      return { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0 };
    }
  }
}
