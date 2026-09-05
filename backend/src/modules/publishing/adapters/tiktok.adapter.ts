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

  getMissingConfig(): string[] {
    const missing: string[] = [];
    const clientKey = (
      this.configService.get<string>('TIKTOK_CLIENT_KEY') ||
      this.configService.get<string>('TIKTOK_CLIENT_ID') ||
      ''
    ).trim();
    const clientSecret = (
      this.configService.get<string>('TIKTOK_CLIENT_SECRET') ||
      ''
    ).trim();

    if (!clientKey) missing.push('TIKTOK_CLIENT_KEY');
    if (!clientSecret) missing.push('TIKTOK_CLIENT_SECRET');

    return missing;
  }

  isConfigured(): boolean {
    return this.getMissingConfig().length === 0;
  }

  getAuthUrl(redirectUri: string, state = 'tiktok_auth'): OAuthAuthUrlResult {
    const missing = this.getMissingConfig();
    const clientKey = (
      this.configService.get<string>('TIKTOK_CLIENT_KEY') ||
      this.configService.get<string>('TIKTOK_CLIENT_ID') ||
      ''
    ).trim();

    this.logger.log(
      `[TikTok OAuth] Configuration check - clientKey: ${
        clientKey ? `configured (length ${clientKey.length})` : 'missing'
      }, clientSecret: ${
        missing.includes('TIKTOK_CLIENT_SECRET') ? 'missing' : 'configured'
      }, redirectUri: ${redirectUri}`,
    );

    if (missing.length > 0) {
      throw new Error(`TikTok integration is not configured. Missing configuration: ${missing.join(', ')}`);
    }

    const scope = 'user.info.basic,video.upload,video.publish';
    const url = `https://www.tiktok.com/v2/auth/authorize/?client_key=${encodeURIComponent(clientKey)}&response_type=code&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
    return { url, state };
  }

  async handleCallback(code: string, redirectUri: string): Promise<OAuthTokenResult> {
    const missing = this.getMissingConfig();
    if (missing.length > 0) {
      throw new Error(`TikTok integration is not configured. Missing configuration: ${missing.join(', ')}`);
    }

    const clientKey = (
      this.configService.get<string>('TIKTOK_CLIENT_KEY') ||
      this.configService.get<string>('TIKTOK_CLIENT_ID') ||
      ''
    ).trim();
    const clientSecret = (
      this.configService.get<string>('TIKTOK_CLIENT_SECRET') ||
      ''
    ).trim();

    this.logger.log(`[TikTok OAuth] Exchanging authorization code with TikTok token API (redirectUri: ${redirectUri})`);

    try {
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
        this.logger.error(`[TikTok OAuth] Token exchange error response: ${JSON.stringify(data.error)}`);
        throw new Error(`TikTok token exchange failed: ${data.error.message || JSON.stringify(data.error)}`);
      }

      const accessToken = data.access_token || data.data?.access_token;
      const refreshToken = data.refresh_token || data.data?.refresh_token;
      const expiresIn = data.expires_in || data.data?.expires_in || 86400;
      const openId = data.open_id || data.data?.open_id;

      if (!accessToken) {
        throw new Error('TikTok token exchange did not return an access token.');
      }

      if (!openId) {
        throw new Error('TikTok token exchange did not return a valid open_id user identifier.');
      }

      this.logger.log(`[TikTok OAuth] Token exchange succeeded for openId ending with ...${openId.slice(-6)}`);

      let accountName = `TikTok User (${openId.slice(-6)})`;
      try {
        const userInfoRes = await axios.get(
          'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url',
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        const userInfo = userInfoRes.data?.data?.user;
        if (userInfo?.display_name) {
          accountName = userInfo.display_name;
        }
      } catch (userErr: any) {
        this.logger.debug(`[TikTok OAuth] Could not fetch user profile details: ${userErr.message}`);
      }

      return {
        accessToken,
        refreshToken,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        accountId: openId,
        accountName,
      };
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const apiErr = err.response.data.error || err.response.data;
        this.logger.error(`[TikTok OAuth] API error: ${JSON.stringify(apiErr)}`);
        throw new Error(`TikTok token exchange failed: ${apiErr.message || JSON.stringify(apiErr)}`);
      }
      throw err;
    }
  }

  async refreshAuthToken(account: PlatformAccount): Promise<OAuthTokenResult> {
    const decryptedRefreshToken = this.encryptionService.decrypt(account.refreshToken);
    const missing = this.getMissingConfig();

    if (!decryptedRefreshToken || missing.length > 0) {
      throw new Error(`Cannot refresh TikTok token: missing refresh token or config (${missing.join(', ')})`);
    }

    const clientKey = (
      this.configService.get<string>('TIKTOK_CLIENT_KEY') ||
      this.configService.get<string>('TIKTOK_CLIENT_ID') ||
      ''
    ).trim();
    const clientSecret = (
      this.configService.get<string>('TIKTOK_CLIENT_SECRET') ||
      ''
    ).trim();

    try {
      const response = await axios.post(
        'https://open.tiktokapis.com/v2/oauth/token/',
        new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          refresh_token: decryptedRefreshToken,
          grant_type: 'refresh_token',
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );

      const data = response.data;
      if (data.error && data.error.code !== 'ok' && data.error.code !== 0) {
        throw new Error(`TikTok refresh error: ${data.error.message || JSON.stringify(data.error)}`);
      }

      const accessToken = data.access_token || data.data?.access_token;
      const refreshToken = data.refresh_token || data.data?.refresh_token || decryptedRefreshToken;
      const expiresIn = data.expires_in || data.data?.expires_in || 86400;

      return {
        accessToken,
        refreshToken,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        accountId: account.accountId || undefined,
        accountName: account.accountName,
      };
    } catch (error: any) {
      this.logger.error(`[TikTok OAuth] Refresh token failed: ${error.message}`);
      throw error;
    }
  }

  async publish(account: PlatformAccount, params: PublishParams): Promise<PublishResult> {
    const decryptedToken = this.encryptionService.decrypt(account.accessToken);

    if (!decryptedToken) {
      this.logger.warn(`TikTok publishing failed: missing access token for account ${account.id}`);
      return {
        success: false,
        errorCode: 'NOT_CONFIGURED',
        errorMessage: 'TikTok API requires a valid user access token to publish videos.',
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
