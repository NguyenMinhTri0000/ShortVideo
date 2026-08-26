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
export class TikTokAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'TIKTOK';
  private readonly logger = new Logger(TikTokAdapter.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
  ) {}

  isConfigured(): boolean {
    const clientKey = this.configService.get<string>('TIKTOK_CLIENT_ID') || this.configService.get<string>('TIKTOK_CLIENT_KEY');
    const clientSecret = this.configService.get<string>('TIKTOK_CLIENT_SECRET');
    return Boolean(clientKey && clientSecret);
  }

  getAuthUrl(redirectUri: string, state = 'tiktok_auth'): OAuthAuthUrlResult {
    const clientKey = this.configService.get<string>('TIKTOK_CLIENT_ID') || this.configService.get<string>('TIKTOK_CLIENT_KEY') || '';
    const scope = 'user.info.basic,video.upload,video.publish';
    const url = `https://www.tiktok.com/v2/auth/authorize/?client_key=${encodeURIComponent(clientKey)}&response_type=code&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
    return { url, state };
  }

  async handleCallback(code: string, redirectUri: string): Promise<OAuthTokenResult> {
    const clientKey = this.configService.get<string>('TIKTOK_CLIENT_ID') || this.configService.get<string>('TIKTOK_CLIENT_KEY') || '';
    const clientSecret = this.configService.get<string>('TIKTOK_CLIENT_SECRET') || '';

    if (!clientKey || !clientSecret) {
      throw new Error('TikTok client key or secret is not configured.');
    }

    const response = await axios.post(
      'https://open.tiktokapis.com/v2/oauth/token/',
      new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );

    const data = response.data;
    if (data.error && data.error.code !== 'ok' && data.error.code !== 0) {
      throw new Error(`TikTok OAuth error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    const accessToken = data.access_token || data.data?.access_token;
    const refreshToken = data.refresh_token || data.data?.refresh_token;
    const expiresIn = data.expires_in || data.data?.expires_in || 86400;
    const openId = data.open_id || data.data?.open_id || 'tiktok_user';

    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      accountId: openId,
      accountName: `TikTok Account (${openId.slice(-6)})`,
    };
  }

  async publish(account: PlatformAccount, params: PublishParams): Promise<PublishResult> {
    const decryptedToken = this.encryptionService.decrypt(account.accessToken);

    if (!this.isConfigured() || !decryptedToken) {
      this.logger.warn(`TikTok publishing failed: Adapter not fully configured or missing access token for account ${account.id}`);
      return {
        success: false,
        errorCode: 'NOT_CONFIGURED',
        errorMessage: 'TikTok API is not fully configured with client credentials or valid user access token.',
      };
    }

    try {
      // Step 1: Initialize Video Direct Post / Inbox Post on TikTok API v2
      const initUrl = 'https://open.tiktokapis.com/v2/post/publish/video/init/';
      const captionText = [params.caption || params.title || '', ...(params.hashtags || []).map((h) => (h.startsWith('#') ? h : `#${h}`))]
        .filter(Boolean)
        .join(' ');

      const initPayload = {
        post_info: {
          title: captionText.slice(0, 2200),
          privacy_level: params.privacyStatus === 'private' ? 'SELF_ONLY' : 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_stitch: false,
          disable_comment: false,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: params.downloadUrl,
        },
      };

      const initResponse = await axios.post(initUrl, initPayload, {
        headers: {
          Authorization: `Bearer ${decryptedToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
      });

      const responseData = initResponse.data;
      if (responseData.error && responseData.error.code !== 'ok' && responseData.error.code !== 0) {
        return {
          success: false,
          errorCode: String(responseData.error.code || 'TIKTOK_API_ERROR'),
          errorMessage: responseData.error.message || 'Failed to initialize TikTok video post.',
          rawResponse: responseData,
        };
      }

      const publishId = responseData.data?.publish_id;
      return {
        success: true,
        platformPostId: publishId,
        platformUrl: publishId ? `https://www.tiktok.com/@${account.accountName}/video/${publishId}` : undefined,
        publishedAt: new Date(),
        rawResponse: responseData,
      };
    } catch (error: any) {
      this.logger.error(`TikTok publish request failed: ${error.message}`, error.stack);
      return {
        success: false,
        errorCode: error.response?.data?.error?.code || 'NETWORK_ERROR',
        errorMessage: error.response?.data?.error?.message || error.message || 'Error executing TikTok API request.',
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
      const response = await axios.post(
        'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
        { publish_id: platformPostId },
        {
          headers: {
            Authorization: `Bearer ${decryptedToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const status = response.data?.data?.status;
      const isPublished = status === 'SUCCESS' || status === 'PUBLISHED';
      return {
        success: isPublished,
        platformPostId,
        errorMessage: isPublished ? undefined : `TikTok post status: ${status}`,
        rawResponse: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        errorCode: 'STATUS_CHECK_FAILED',
        errorMessage: error.message,
      };
    }
  }

  async fetchAnalytics(account: PlatformAccount, platformPostId: string): Promise<PlatformMetrics> {
    const decryptedToken = this.encryptionService.decrypt(account.accessToken);
    if (!decryptedToken) {
      return { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0 };
    }

    try {
      const response = await axios.post(
        'https://open.tiktokapis.com/v2/video/query/',
        {
          filters: { video_ids: [platformPostId] },
          fields: ['id', 'title', 'like_count', 'comment_count', 'share_count', 'view_count'],
        },
        {
          headers: {
            Authorization: `Bearer ${decryptedToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const videoData = response.data?.data?.videos?.[0] || {};
      const views = Number(videoData.view_count || 0);
      const likes = Number(videoData.like_count || 0);
      const comments = Number(videoData.comment_count || 0);
      const shares = Number(videoData.share_count || 0);
      const engagementRate = views > 0 ? (likes + comments + shares) / views : 0;

      return {
        views,
        likes,
        comments,
        shares,
        saves: 0,
        clicks: 0,
        engagementRate,
        rawMetadata: response.data,
      };
    } catch (error) {
      this.logger.warn(`Failed to fetch TikTok analytics for post ${platformPostId}: ${(error as Error).message}`);
      return { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0 };
    }
  }
}
