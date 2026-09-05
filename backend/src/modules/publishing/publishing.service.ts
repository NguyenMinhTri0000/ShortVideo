import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { EncryptionService } from './encryption.service';
import { TikTokAdapter } from './adapters/tiktok.adapter';
import { YouTubeAdapter } from './adapters/youtube.adapter';
import { InstagramAdapter } from './adapters/instagram.adapter';
import { FacebookAdapter } from './adapters/facebook.adapter';
import { IsString, IsOptional, IsBoolean, IsArray, IsEnum } from 'class-validator';
import { PlatformAdapter, PlatformType } from './adapters/platform-adapter.interface';

export class CreateAccountDto {
  @IsString()
  platform!: string;


  @IsString()
  accountName!: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  tokenExpiresAt?: Date | string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class CreatePublishJobDto {
  @IsString()
  videoId!: string;

  @IsString()
  platformAccountId!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsArray()
  hashtags?: string[];

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsString()
  privacyStatus?: string;

  @IsOptional()
  platformMetadata?: Record<string, any>;

  @IsOptional()
  scheduledAt?: Date | string;

  @IsOptional()
  @IsBoolean()
  allowDuplicate?: boolean;
}


@Injectable()
export class PublishingService {
  private readonly logger = new Logger(PublishingService.name);
  private readonly adapters: Map<PlatformType, PlatformAdapter> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly encryptionService: EncryptionService,
    private readonly tiktokAdapter: TikTokAdapter,
    private readonly youtubeAdapter: YouTubeAdapter,
    private readonly instagramAdapter: InstagramAdapter,
    private readonly facebookAdapter: FacebookAdapter,
    @InjectQueue('publishing-queue') private readonly publishingQueue: Queue,
    @InjectQueue('analytics-queue') private readonly analyticsQueue: Queue,
  ) {
    this.adapters.set('TIKTOK', this.tiktokAdapter);
    this.adapters.set('YOUTUBE', this.youtubeAdapter);
    this.adapters.set('INSTAGRAM', this.instagramAdapter);
    this.adapters.set('FACEBOOK', this.facebookAdapter);
  }

  getAdapter(platform: PlatformType): PlatformAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
    return adapter;
  }

  // --- ACCOUNTS MANAGEMENT ---

  async getConfigStatus() {
    const status: Record<string, { isConfigured: boolean; missing: string[] }> = {};
    for (const [platform, adapter] of this.adapters.entries()) {
      status[platform] = {
        isConfigured: adapter.isConfigured(),
        missing: adapter.getMissingConfig ? adapter.getMissingConfig() : [],
      };
    }
    return status;
  }

  async createAccount(dto: CreateAccountDto) {
    const encryptedAccess = this.encryptionService.encrypt(dto.accessToken);
    const encryptedRefresh = this.encryptionService.encrypt(dto.refreshToken);

    const isAdapterConfigured = this.getAdapter(dto.platform.toUpperCase() as PlatformType).isConfigured();
    const hasToken = Boolean(dto.accessToken && dto.accessToken.trim());
    const status = hasToken || isAdapterConfigured ? 'ACTIVE' : 'NOT_CONFIGURED';

    const account = await this.prisma.platformAccount.create({
      data: {
        platform: dto.platform,
        accountName: dto.accountName,
        accountId: dto.accountId,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: dto.tokenExpiresAt ? new Date(dto.tokenExpiresAt) : null,
        status,
        metadata: dto.metadata || {},
      },
    });

    return this.encryptionService.sanitizeAccount(account);
  }

  async getAccounts() {
    const accounts = await this.prisma.platformAccount.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return accounts.map((acc) => {
      const adapter = this.adapters.get(acc.platform as PlatformType);
      const isConfigured = adapter ? adapter.isConfigured() : false;
      return {
        ...this.encryptionService.sanitizeAccount(acc),
        isConfigured,
      };
    });
  }

  async getAccountById(id: string) {
    const account = await this.prisma.platformAccount.findUnique({
      where: { id },
    });
    if (!account) {
      throw new NotFoundException(`Platform account with ID ${id} not found.`);
    }
    return this.encryptionService.sanitizeAccount(account);
  }

  async deleteAccount(id: string) {
    await this.getAccountById(id);
    return this.prisma.platformAccount.delete({
      where: { id },
    });
  }

  async getOAuthUrl(platform: PlatformType, redirectUri: string) {
    const adapter = this.getAdapter(platform);
    if (!adapter.isConfigured()) {
      const missingKeys = adapter.getMissingConfig ? adapter.getMissingConfig() : [];
      if (missingKeys.length > 0) {
        throw new BadRequestException(
          `${platform} integration is not configured. Missing configuration: ${missingKeys.join(', ')}`,
        );
      }
      throw new BadRequestException(`API credentials for ${platform} are not configured in backend.`);
    }
    if (!adapter.getAuthUrl) {
      throw new BadRequestException(`OAuth not supported for ${platform}`);
    }
    return adapter.getAuthUrl(redirectUri);
  }

  async handleOAuthCallback(platform: PlatformType, code: string, redirectUri: string) {
    const adapter = this.getAdapter(platform);
    if (!adapter.handleCallback) {
      throw new BadRequestException(`OAuth callback not supported for ${platform}`);
    }

    const tokenResult = await adapter.handleCallback(code, redirectUri);
    const dummyIds = ['facebook_page', 'instagram_account', 'tiktok_user', 'youtube_channel'];
    if (!tokenResult.accountId || dummyIds.includes(tokenResult.accountId)) {
      throw new BadRequestException(
        `OAuth callback completed, but could not resolve a valid target ${platform} account identity.`,
      );
    }

    return this.createAccount({
      platform,
      accountName: tokenResult.accountName || `${platform} Account`,
      accountId: tokenResult.accountId,
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken,
      tokenExpiresAt: tokenResult.expiresAt,
      metadata: tokenResult.metadata,
    });
  }

  // --- PUBLISHING JOBS ---

  async createJob(dto: CreatePublishJobDto) {
    // 1. Verify Video existence
    const video = await this.prisma.video.findUnique({
      where: { id: dto.videoId },
    });
    if (!video) {
      throw new NotFoundException(`Video with ID ${dto.videoId} not found.`);
    }

    // 2. Verify Platform Account existence
    const account = await this.prisma.platformAccount.findUnique({
      where: { id: dto.platformAccountId },
    });
    if (!account) {
      throw new NotFoundException(`Platform Account with ID ${dto.platformAccountId} not found.`);
    }

    // 3. Duplicate Protection Check
    if (!dto.allowDuplicate) {
      const activeJob = await this.prisma.publishJob.findFirst({
        where: {
          videoId: dto.videoId,
          platformAccountId: dto.platformAccountId,
          status: { in: ['SCHEDULED', 'QUEUED', 'PUBLISHING', 'PUBLISHED'] },
        },
      });

      if (activeJob) {
        throw new ConflictException(
          `A publish job already exists for video ${dto.videoId} on account ${account.accountName} (Status: ${activeJob.status}). Pass allowDuplicate=true to bypass.`,
        );
      }
    }

    // 4. Determine Status & Schedule Time
    const now = new Date();
    const scheduledDate = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const isScheduled = Boolean(scheduledDate && scheduledDate > now);
    const initialStatus = isScheduled ? 'SCHEDULED' : 'QUEUED';

    const job = await this.prisma.publishJob.create({
      data: {
        videoId: dto.videoId,
        platformAccountId: dto.platformAccountId,
        platform: account.platform,
        title: dto.title || video.title,
        description: dto.description || video.script || undefined,
        caption: dto.caption || dto.title || video.title,
        hashtags: dto.hashtags || [],
        tags: dto.tags || [],
        privacyStatus: dto.privacyStatus || 'public',
        platformMetadata: dto.platformMetadata || {},
        scheduledAt: scheduledDate,
        status: initialStatus,
      },
    });

    // 5. Enqueue in BullMQ
    const delayMs = isScheduled && scheduledDate ? scheduledDate.getTime() - Date.now() : 0;
    await this.publishingQueue.add(
      'publish-video',
      { jobId: job.id },
      {
        delay: Math.max(0, delayMs),
        jobId: job.id,
      },
    );

    this.logger.log(`Created publish job ${job.id} for platform ${account.platform} (Status: ${initialStatus}, Delay: ${delayMs}ms)`);
    return job;
  }

  async getJobById(id: string) {
    const job = await this.prisma.publishJob.findUnique({
      where: { id },
      include: {
        video: true,
        platformAccount: true,
        analyticsSnapshots: {
          orderBy: { collectedAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`PublishJob with ID ${id} not found.`);
    }

    return {
      ...job,
      platformAccount: this.encryptionService.sanitizeAccount(job.platformAccount),
    };
  }

  async listJobs(filters?: { platform?: string; status?: string; videoId?: string }) {
    const where: any = {};
    if (filters?.platform) where.platform = filters.platform;
    if (filters?.status) where.status = filters.status;
    if (filters?.videoId) where.videoId = filters.videoId;

    const jobs = await this.prisma.publishJob.findMany({
      where,
      include: {
        video: { select: { id: true, title: true, videoObjectKey: true } },
        platformAccount: { select: { id: true, platform: true, accountName: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return jobs;
  }

  async retryJob(id: string) {
    const job = await this.prisma.publishJob.findUnique({
      where: { id },
    });

    if (!job) {
      throw new NotFoundException(`PublishJob with ID ${id} not found.`);
    }

    if (job.status === 'PUBLISHING' || job.status === 'PUBLISHED') {
      throw new BadRequestException(`Cannot retry job in status ${job.status}`);
    }

    const updatedJob = await this.prisma.publishJob.update({
      where: { id },
      data: {
        status: 'QUEUED',
        errorMessage: null,
        errorCode: null,
        retryCount: job.retryCount + 1,
        lastAttemptAt: new Date(),
      },
    });

    await this.publishingQueue.add(
      'publish-video',
      { jobId: updatedJob.id },
      { jobId: `${updatedJob.id}-retry-${updatedJob.retryCount}` },
    );

    return updatedJob;
  }

  async cancelJob(id: string) {
    const job = await this.prisma.publishJob.findUnique({
      where: { id },
    });

    if (!job) {
      throw new NotFoundException(`PublishJob with ID ${id} not found.`);
    }

    if (job.status === 'PUBLISHED') {
      throw new BadRequestException('Cannot cancel an already published job.');
    }

    const updated = await this.prisma.publishJob.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    try {
      const bullJob = await this.publishingQueue.getJob(id);
      if (bullJob) {
        await bullJob.remove();
      }
    } catch {
      // Ignore if job missing from BullMQ queue
    }

    return updated;
  }

  private safeString(val: any, fallback = ''): string {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val);
      } catch {
        return String(val);
      }
    }
    return String(val);
  }

  private async ensureFreshToken(account: any, adapter: PlatformAdapter): Promise<any> {
    if (!adapter.refreshAuthToken || !account.refreshToken) {
      return account;
    }

    const expiresAtMs = account.tokenExpiresAt ? new Date(account.tokenExpiresAt).getTime() : 0;
    const isExpiredOrExpiringSoon = !expiresAtMs || expiresAtMs - Date.now() < 5 * 60 * 1000;

    if (!isExpiredOrExpiringSoon) {
      return account;
    }

    try {
      this.logger.log(`Refreshing access token for ${account.platform} account "${account.accountName}" (${account.id})...`);
      const refreshed = await adapter.refreshAuthToken(account);
      const encryptedAccess = this.encryptionService.encrypt(refreshed.accessToken);
      const encryptedRefresh = refreshed.refreshToken
        ? this.encryptionService.encrypt(refreshed.refreshToken)
        : account.refreshToken;

      const updatedAccount = await this.prisma.platformAccount.update({
        where: { id: account.id },
        data: {
          accessToken: encryptedAccess,
          refreshToken: encryptedRefresh,
          tokenExpiresAt: refreshed.expiresAt,
          status: 'ACTIVE',
        },
      });

      this.logger.log(`Successfully refreshed access token for ${account.platform} account "${account.accountName}".`);
      return updatedAccount;
    } catch (err: any) {
      this.logger.error(`Failed to auto-refresh token for account ${account.id}: ${err.message || err}`);
      return account;
    }
  }

  // --- JOB EXECUTION WORKER STEP ---

  async executePublishJob(jobId: string): Promise<void> {
    const job = await this.prisma.publishJob.findUnique({
      where: { id: jobId },
      include: { video: true, platformAccount: true },
    });

    if (!job) {
      this.logger.error(`Cannot execute job ${jobId}: Job not found.`);
      return;
    }

    if (job.status === 'CANCELLED' || job.status === 'PUBLISHED') {
      this.logger.warn(`Skipping execution for job ${jobId} with status ${job.status}`);
      return;
    }

    // Update status to PUBLISHING
    await this.prisma.publishJob.update({
      where: { id: jobId },
      data: {
        status: 'PUBLISHING',
        lastAttemptAt: new Date(),
      },
    });

    try {
      const adapter = this.getAdapter(job.platform as PlatformType);

      // Auto-refresh access token if expired or expiring soon
      let activeAccount = await this.ensureFreshToken(job.platformAccount, adapter);

      // Get download URL / stream from MinIO / StorageService
      const downloadUrl = await this.storageService.getDownloadUrl(job.video.videoObjectKey, 86400);

      let videoBuffer: Buffer | undefined;
      try {
        const streamResult = await this.storageService.getFileStream(job.video.videoObjectKey);
        const chunks: Uint8Array[] = [];
        for await (const chunk of streamResult.stream) {
          chunks.push(chunk);
        }
        videoBuffer = Buffer.concat(chunks);
      } catch (err: any) {
        this.logger.warn(`Could not load video buffer directly from MinIO: ${err.message || err}`);
      }

      const publishParams = {
        jobId: job.id,
        videoId: job.videoId,
        title: job.title || job.video.title,
        description: job.description || undefined,
        caption: job.caption || undefined,
        hashtags: job.hashtags,
        tags: job.tags,
        privacyStatus: job.privacyStatus || 'public',
        platformMetadata: (job.platformMetadata as Record<string, any>) || {},
        downloadUrl,
        videoBuffer,
      };

      let publishResult = await adapter.publish(activeAccount, publishParams);

      // If failed with 401 Auth error, force a refresh once and retry publish
      const isAuthError = !publishResult.success && (
        String(publishResult.errorCode) === '401' ||
        String(publishResult.errorCode) === 'UNAUTHORIZED' ||
        String(publishResult.errorMessage).includes('invalid authentication credentials')
      );

      if (isAuthError && adapter.refreshAuthToken && activeAccount.refreshToken) {
        this.logger.warn(`Job ${jobId} failed with auth error 401. Attempting forced token refresh and retry...`);
        try {
          const refreshed = await adapter.refreshAuthToken(activeAccount);
          const encryptedAccess = this.encryptionService.encrypt(refreshed.accessToken);
          const encryptedRefresh = refreshed.refreshToken
            ? this.encryptionService.encrypt(refreshed.refreshToken)
            : activeAccount.refreshToken;

          activeAccount = await this.prisma.platformAccount.update({
            where: { id: activeAccount.id },
            data: {
              accessToken: encryptedAccess,
              refreshToken: encryptedRefresh,
              tokenExpiresAt: refreshed.expiresAt,
              status: 'ACTIVE',
            },
          });
          publishResult = await adapter.publish(activeAccount, publishParams);
        } catch (refreshErr: any) {
          this.logger.error(`Forced token refresh failed: ${refreshErr.message || refreshErr}`);
        }
      }

      if (publishResult.success) {
        await this.prisma.publishJob.update({
          where: { id: jobId },
          data: {
            status: 'PUBLISHED',
            publishedAt: publishResult.publishedAt || new Date(),
            platformPostId: this.safeString(publishResult.platformPostId),
            platformUrl: this.safeString(publishResult.platformUrl),
            errorMessage: null,
            errorCode: null,
          },
        });

        this.logger.log(`Successfully published job ${jobId} to ${job.platform} (PostID: ${publishResult.platformPostId})`);

        // Schedule initial analytics collection snapshot (after 1 hour)
        await this.analyticsQueue.add(
          'collect-analytics',
          { publishJobId: jobId, intervalLabel: '1h' },
          { delay: 3600 * 1000 },
        );
      } else {
        await this.prisma.publishJob.update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            errorMessage: this.safeString(publishResult.errorMessage, 'Publishing failed without specific error message.'),
            errorCode: this.safeString(publishResult.errorCode, 'UNKNOWN_ERROR'),
          },
        });

        this.logger.error(`Publish job ${jobId} failed: ${publishResult.errorMessage} (Code: ${publishResult.errorCode})`);
      }
    } catch (error: any) {
      const errorMsg = this.safeString(error?.message || error, 'Internal error during job execution.');
      const errorCode = this.safeString(error?.code || error?.errorCode, 'INTERNAL_JOB_ERROR');

      this.logger.error(`Execution crash on publish job ${jobId}: ${errorMsg}`, error?.stack);

      try {
        await this.prisma.publishJob.update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            errorMessage: errorMsg,
            errorCode: errorCode,
          },
        });
      } catch (updateErr: any) {
        this.logger.error(`Failed to record job ${jobId} failure state: ${updateErr?.message || updateErr}`);
      }
    }
  }
}
