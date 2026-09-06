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
export class YouTubeAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'YOUTUBE';
  private readonly logger = new Logger(YouTubeAdapter.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
  ) {}

  isConfigured(): boolean {
    const clientId = this.configService.get<string>('YOUTUBE_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'YOUTUBE_CLIENT_SECRET',
    );
    return Boolean(clientId && clientSecret);
  }

  getAuthUrl(redirectUri: string, state = 'youtube_auth'): OAuthAuthUrlResult {
    const clientId = this.configService.get<string>('YOUTUBE_CLIENT_ID') || '';
    const scope =
      'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly';
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&response_type=code&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;
    return { url, state };
  }

  async handleCallback(
    code: string,
    redirectUri: string,
  ): Promise<OAuthTokenResult> {
    const clientId = this.configService.get<string>('YOUTUBE_CLIENT_ID') || '';
    const clientSecret =
      this.configService.get<string>('YOUTUBE_CLIENT_SECRET') || '';

    if (!clientId || !clientSecret) {
      throw new Error('YouTube client ID or secret is not configured.');
    }

    const response = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );

    const data = response.data;
    const accessToken = data.access_token;
    const refreshToken = data.refresh_token;
    const expiresIn = data.expires_in || 3600;

    // Retrieve channel info
    let accountId = 'youtube_channel';
    let accountName = 'YouTube Channel';

    try {
      const channelRes = await axios.get(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const channelItem = channelRes.data?.items?.[0];
      if (channelItem) {
        accountId = channelItem.id;
        accountName = channelItem.snippet?.title || accountName;
      }
    } catch {
      // Fallback
    }

    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      accountId,
      accountName,
    };
  }

  async refreshAuthToken(account: PlatformAccount): Promise<OAuthTokenResult> {
    const decryptedRefreshToken = this.encryptionService.decrypt(
      account.refreshToken,
    );
    const clientId = this.configService.get<string>('YOUTUBE_CLIENT_ID') || '';
    const clientSecret =
      this.configService.get<string>('YOUTUBE_CLIENT_SECRET') || '';

    if (!decryptedRefreshToken || !clientId || !clientSecret) {
      throw new Error(
        'Cannot refresh token: missing refresh token or client credentials.',
      );
    }

    const response = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: decryptedRefreshToken,
        grant_type: 'refresh_token',
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );

    const data = response.data;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || decryptedRefreshToken,
      expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
      accountId: account.accountId || undefined,
      accountName: account.accountName,
    };
  }

  async publish(
    account: PlatformAccount,
    params: PublishParams,
  ): Promise<PublishResult> {
    const decryptedToken = this.encryptionService.decrypt(account.accessToken);

    if (!decryptedToken) {
      this.logger.warn(
        `YouTube Shorts publishing failed: missing token for account ${account.id}`,
      );
      return {
        success: false,
        errorCode: 'NOT_CONFIGURED',
        errorMessage:
          'YouTube Shorts API requires a valid user token to publish videos.',
      };
    }

    try {
      const title = (params.title || 'Affiliate Short Video').slice(0, 100);
      const description = [
        params.description || params.caption || '',
        '#Shorts',
        ...(params.hashtags || []).map((h) =>
          h.startsWith('#') ? h : `#${h}`,
        ),
      ]
        .filter(Boolean)
        .join(' ')
        .slice(0, 5000);

      const snippet = {
        title,
        description,
        tags: [...(params.tags || []), 'Shorts'],
        categoryId: '22', // People & Blogs / General
      };

      const status = {
        privacyStatus: params.privacyStatus || 'public',
        selfDeclaredMadeForKids: false,
      };

      // YouTube API Upload (Metadata + Init upload session)
      const initResponse = await axios.post(
        'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
        { snippet, status },
        {
          headers: {
            Authorization: `Bearer ${decryptedToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': params.mimeType || 'video/mp4',
          },
        },
      );

      const uploadUrl = initResponse.headers['location'];
      if (!uploadUrl && !initResponse.data?.id) {
        return {
          success: false,
          errorCode: 'UPLOAD_SESSION_FAILED',
          errorMessage: 'YouTube API did not return an upload session URL.',
          rawResponse: initResponse.data,
        };
      }

      // If uploadUrl returned, stream buffer/file bytes
      let finalVideoId = initResponse.data?.id;
      let bufferToUpload = params.videoBuffer;

      if (uploadUrl && !bufferToUpload && params.downloadUrl) {
        try {
          const downloadRes = await axios.get(params.downloadUrl, {
            responseType: 'arraybuffer',
          });
          bufferToUpload = Buffer.from(downloadRes.data);
        } catch (downloadErr: any) {
          this.logger.error(
            `Failed to download video bytes from downloadUrl: ${downloadErr.message || downloadErr}`,
          );
        }
      }

      if (uploadUrl && bufferToUpload) {
        const uploadRes = await axios.put(uploadUrl, bufferToUpload, {
          headers: {
            'Content-Type': params.mimeType || 'video/mp4',
            'Content-Length': bufferToUpload.length,
          },
        });
        finalVideoId = uploadRes.data?.id || finalVideoId;
      }

      if (!finalVideoId) {
        return {
          success: false,
          errorCode: 'YOUTUBE_UPLOAD_FAILED',
          errorMessage: 'YouTube video upload did not yield a valid video ID.',
        };
      }

      return {
        success: true,
        platformPostId: finalVideoId,
        platformUrl: `https://www.youtube.com/shorts/${finalVideoId}`,
        publishedAt: new Date(),
        rawResponse: initResponse.data,
      };
    } catch (error: any) {
      this.logger.error(
        `YouTube Shorts upload failed: ${error.message}`,
        error.stack,
      );
      const is401 =
        error.response?.status === 401 ||
        error.response?.data?.error?.code === 401;
      return {
        success: false,
        errorCode: is401
          ? '401'
          : error.response?.data?.error?.code || 'YOUTUBE_API_ERROR',
        errorMessage: is401
          ? 'Phiên đăng nhập YouTube đã hết hạn (Google OAuth 401). Vui lòng nhấn nút "Sign in YouTube Account" ở trên để kết nối lại tài khoản.'
          : error.response?.data?.error?.message ||
            error.message ||
            'Failed to publish video to YouTube Shorts.',
        rawResponse: error.response?.data,
      };
    }
  }

  async getPostStatus(
    account: PlatformAccount,
    platformPostId: string,
  ): Promise<PublishResult> {
    const decryptedToken = this.encryptionService.decrypt(account.accessToken);
    if (!decryptedToken) {
      return {
        success: false,
        errorCode: 'NOT_CONFIGURED',
        errorMessage: 'Missing access token.',
      };
    }

    try {
      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/videos?part=status,uploadStatus&id=${platformPostId}`,
        {
          headers: { Authorization: `Bearer ${decryptedToken}` },
        },
      );

      const item = response.data?.items?.[0];
      if (!item) {
        return {
          success: false,
          errorCode: 'POST_NOT_FOUND',
          errorMessage: 'YouTube video not found.',
        };
      }

      const status = item.status?.uploadStatus || 'processed';
      return {
        success: status === 'processed' || status === 'uploaded',
        platformPostId,
        platformUrl: `https://www.youtube.com/shorts/${platformPostId}`,
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

  async fetchAnalytics(
    account: PlatformAccount,
    platformPostId: string,
  ): Promise<PlatformMetrics> {
    const decryptedToken = this.encryptionService.decrypt(account.accessToken);
    if (!decryptedToken) {
      return {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        clicks: 0,
      };
    }

    try {
      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${platformPostId}`,
        {
          headers: { Authorization: `Bearer ${decryptedToken}` },
        },
      );

      const stats = response.data?.items?.[0]?.statistics || {};
      const views = Number(stats.viewCount || 0);
      const likes = Number(stats.likeCount || 0);
      const comments = Number(stats.commentCount || 0);
      const engagementRate = views > 0 ? (likes + comments) / views : 0;

      return {
        views,
        likes,
        comments,
        shares: 0,
        saves: 0,
        clicks: 0,
        engagementRate,
        rawMetadata: response.data,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to fetch YouTube analytics for post ${platformPostId}: ${(error as Error).message}`,
      );
      return {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        clicks: 0,
      };
    }
  }
}
