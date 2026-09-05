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
export class InstagramAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'INSTAGRAM';
  private readonly logger = new Logger(InstagramAdapter.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
  ) {}

  getMissingConfig(): string[] {
    const missing: string[] = [];
    const appId = (
      this.configService.get<string>('INSTAGRAM_CLIENT_ID') ||
      this.configService.get<string>('FACEBOOK_APP_ID') ||
      ''
    ).trim();
    const appSecret = (
      this.configService.get<string>('INSTAGRAM_CLIENT_SECRET') ||
      this.configService.get<string>('FACEBOOK_APP_SECRET') ||
      ''
    ).trim();

    if (!appId) missing.push('INSTAGRAM_CLIENT_ID (or FACEBOOK_APP_ID)');
    if (!appSecret) missing.push('INSTAGRAM_CLIENT_SECRET (or FACEBOOK_APP_SECRET)');

    return missing;
  }

  isConfigured(): boolean {
    return this.getMissingConfig().length === 0;
  }

  getAuthUrl(redirectUri: string, state = 'instagram_auth'): OAuthAuthUrlResult {
    const appId =
      this.configService.get<string>('INSTAGRAM_CLIENT_ID') ||
      this.configService.get<string>('FACEBOOK_APP_ID') ||
      '';
    const scope =
      'instagram_basic,instagram_content_publish,instagram_manage_insights,pages_show_list,pages_read_engagement';
    const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&response_type=code&state=${encodeURIComponent(state)}`;
    return { url, state };
  }

  async handleCallback(code: string, redirectUri: string): Promise<OAuthTokenResult> {
    const appId =
      this.configService.get<string>('INSTAGRAM_CLIENT_ID') ||
      this.configService.get<string>('FACEBOOK_APP_ID') ||
      '';
    const appSecret =
      this.configService.get<string>('INSTAGRAM_CLIENT_SECRET') ||
      this.configService.get<string>('FACEBOOK_APP_SECRET') ||
      '';

    if (!appId || !appSecret) {
      throw new Error('Instagram app ID or secret is not configured.');
    }

    try {
      const tokenRes = await axios.get(
        `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`,
      );

      const accessToken = tokenRes.data.access_token;
      const expiresIn = tokenRes.data.expires_in || 5184000;

      // 1. Fetch user's Facebook pages
      const meRes = await axios.get(
        `https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}`,
      );

      const pages = meRes.data?.data;
      if (!Array.isArray(pages) || pages.length === 0) {
        throw new Error(
          'Instagram connection failed: No Facebook Page was found for this Meta account. Instagram Business publishing requires a Facebook Page linked to an Instagram Professional account.',
        );
      }

      // 2. Search pages for a connected Instagram Business/Creator Account
      let accountId: string | null = null;
      let accountName = 'Instagram Account';

      for (const page of pages) {
        const pageId = page.id;
        const igRes = await axios.get(
          `https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account,name&access_token=${accessToken}`,
        );

        const igBusinessId = igRes.data?.instagram_business_account?.id;
        if (igBusinessId) {
          accountId = igBusinessId;
          
          // Fetch real Instagram username
          try {
            const igUserRes = await axios.get(
              `https://graph.facebook.com/v19.0/${igBusinessId}?fields=username,name&access_token=${accessToken}`,
            );
            if (igUserRes.data?.username) {
              accountName = `@${igUserRes.data.username}`;
            } else {
              accountName = `@${igRes.data.name || 'ig_user'}`;
            }
          } catch {
            accountName = `@${igRes.data.name || 'ig_user'}`;
          }
          break;
        }
      }

      if (!accountId || accountId === 'instagram_account') {
        throw new Error(
          'Instagram authorization succeeded, but no Instagram Professional (Business or Creator) account was found linked to your Facebook Page(s). Please connect an Instagram Professional account to a Facebook Page in Meta Business Suite.',
        );
      }

      return {
        accessToken,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        accountId,
        accountName,
      };
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        const metaErr = err.response.data.error;
        this.logger.error(`Instagram OAuth error: ${JSON.stringify(metaErr)}`);
        throw new Error(`Instagram OAuth token exchange failed: ${metaErr.message || JSON.stringify(metaErr)}`);
      }
      throw err;
    }
  }

  async publish(account: PlatformAccount, params: PublishParams): Promise<PublishResult> {
    const decryptedToken = this.encryptionService.decrypt(account.accessToken);

    if (!this.isConfigured() || !decryptedToken || !account.accountId) {
      this.logger.warn(`Instagram Reels publishing failed: Adapter not fully configured or missing account ID/token for account ${account.id}`);
      return {
        success: false,
        errorCode: 'NOT_CONFIGURED',
        errorMessage: 'Instagram Reels API is not fully configured with Graph API credentials or connected account.',
      };
    }

    try {
      const captionText = [params.caption || params.title || '', ...(params.hashtags || []).map((h) => (h.startsWith('#') ? h : `#${h}`))]
        .filter(Boolean)
        .join(' ');

      // Step 1: Create Container
      const createContainerRes = await axios.post(
        `https://graph.facebook.com/v19.0/${account.accountId}/media`,
        {
          media_type: 'REELS',
          video_url: params.downloadUrl,
          caption: captionText,
          access_token: decryptedToken,
        },
      );

      const creationId = createContainerRes.data?.id;
      if (!creationId) {
        return {
          success: false,
          errorCode: 'CONTAINER_CREATION_FAILED',
          errorMessage: 'Instagram API did not return container creation ID.',
          rawResponse: createContainerRes.data,
        };
      }

      // Step 2: Wait / Poll Container Status
      let isReady = false;
      let attempts = 0;
      while (!isReady && attempts < 10) {
        await new Promise((res) => setTimeout(res, 2000));
        attempts++;
        const statusRes = await axios.get(
          `https://graph.facebook.com/v19.0/${creationId}?fields=status_code,status&access_token=${decryptedToken}`,
        );
        const statusCode = statusRes.data?.status_code;
        if (statusCode === 'FINISHED') {
          isReady = true;
        } else if (statusCode === 'ERROR') {
          return {
            success: false,
            errorCode: 'PROCESSING_ERROR',
            errorMessage: 'Instagram media container processing failed.',
            rawResponse: statusRes.data,
          };
        }
      }

      // Step 3: Publish Container
      const publishRes = await axios.post(
        `https://graph.facebook.com/v19.0/${account.accountId}/media_publish`,
        {
          creation_id: creationId,
          access_token: decryptedToken,
        },
      );

      const mediaId = publishRes.data?.id;
      return {
        success: Boolean(mediaId),
        platformPostId: mediaId || creationId,
        platformUrl: mediaId ? `https://www.instagram.com/p/${mediaId}` : undefined,
        publishedAt: new Date(),
        rawResponse: publishRes.data,
      };
    } catch (error: any) {
      this.logger.error(`Instagram Reels publish request failed: ${error.message}`, error.stack);
      return {
        success: false,
        errorCode: error.response?.data?.error?.code || 'INSTAGRAM_API_ERROR',
        errorMessage: error.response?.data?.error?.message || error.message || 'Error executing Instagram API request.',
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
        `https://graph.facebook.com/v19.0/${platformPostId}?fields=id,timestamp,permalink&access_token=${decryptedToken}`,
      );

      return {
        success: Boolean(response.data?.id),
        platformPostId: response.data?.id || platformPostId,
        platformUrl: response.data?.permalink,
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
        `https://graph.facebook.com/v19.0/${platformPostId}/insights?metric=plays,reach,likes,comments,shares,saved&access_token=${decryptedToken}`,
      );

      const dataList = response.data?.data || [];
      const getVal = (name: string) => {
        const item = dataList.find((i: any) => i.name === name);
        return item?.values?.[0]?.value || 0;
      };

      const views = getVal('plays') || getVal('reach');
      const likes = getVal('likes');
      const comments = getVal('comments');
      const shares = getVal('shares');
      const saves = getVal('saved');
      const engagementRate = views > 0 ? (likes + comments + shares + saves) / views : 0;

      return {
        views,
        likes,
        comments,
        shares,
        saves,
        clicks: 0,
        engagementRate,
        rawMetadata: response.data,
      };
    } catch (error) {
      this.logger.warn(`Failed to fetch Instagram analytics for post ${platformPostId}: ${(error as Error).message}`);
      return { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0 };
    }
  }
}
