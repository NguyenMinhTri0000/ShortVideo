import { PlatformAccount, PublishJob } from '@prisma/client';
import { Readable } from 'stream';

export type PlatformType = 'TIKTOK' | 'YOUTUBE' | 'INSTAGRAM' | 'FACEBOOK';

export interface PublishParams {
  jobId: string;
  videoId: string;
  title?: string;
  description?: string;
  caption?: string;
  hashtags?: string[];
  tags?: string[];
  privacyStatus?: string;
  platformMetadata?: Record<string, any>;
  videoStream?: Readable;
  videoBuffer?: Buffer;
  mimeType?: string;
  downloadUrl?: string;
}

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  platformUrl?: string;
  publishedAt?: Date;
  errorMessage?: string;
  errorCode?: string;
  rawResponse?: any;
}

export interface PlatformMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  watchTime?: number;
  averageWatchTime?: number;
  completionRate?: number;
  engagementRate?: number;
  rawMetadata?: any;
}

export interface OAuthAuthUrlResult {
  url: string;
  state?: string;
}

export interface OAuthTokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  accountId?: string;
  accountName?: string;
  metadata?: Record<string, any>;
}

export interface PlatformAdapter {
  readonly platform: PlatformType;
  isConfigured(): boolean;
  getMissingConfig?(): string[];
  publish(account: PlatformAccount, params: PublishParams): Promise<PublishResult>;
  getPostStatus(account: PlatformAccount, platformPostId: string): Promise<PublishResult>;
  fetchAnalytics(account: PlatformAccount, platformPostId: string): Promise<PlatformMetrics>;
  getAuthUrl?(redirectUri: string, state?: string): OAuthAuthUrlResult;
  handleCallback?(code: string, redirectUri: string): Promise<OAuthTokenResult>;
  refreshAuthToken?(account: PlatformAccount): Promise<OAuthTokenResult>;
}
