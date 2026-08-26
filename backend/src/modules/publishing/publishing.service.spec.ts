import { Test, TestingModule } from '@nestjs/testing';
import { PublishingService } from './publishing.service';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { EncryptionService } from './encryption.service';
import { TikTokAdapter } from './adapters/tiktok.adapter';
import { YouTubeAdapter } from './adapters/youtube.adapter';
import { InstagramAdapter } from './adapters/instagram.adapter';
import { FacebookAdapter } from './adapters/facebook.adapter';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('PublishingService', () => {
  let service: PublishingService;
  let prisma: PrismaService;
  let encryptionService: EncryptionService;

  const mockPrismaService = {
    platformAccount: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    video: {
      findUnique: jest.fn(),
    },
    publishJob: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockStorageService = {
    getDownloadUrl: jest.fn().mockResolvedValue('http://localhost:29000/videos/sample.mp4'),
  };

  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'bull-job-1' }),
    getJob: jest.fn().mockResolvedValue(null),
  };

  const mockTikTokAdapter = {
    platform: 'TIKTOK',
    isConfigured: jest.fn().mockReturnValue(true),
    publish: jest.fn().mockResolvedValue({
      success: true,
      platformPostId: 'tiktok_post_123',
      platformUrl: 'https://www.tiktok.com/@test/video/tiktok_post_123',
      publishedAt: new Date(),
    }),
    fetchAnalytics: jest.fn().mockResolvedValue({ views: 1000, likes: 100, comments: 10, shares: 5 }),
  };

  const mockYouTubeAdapter = {
    platform: 'YOUTUBE',
    isConfigured: jest.fn().mockReturnValue(false),
    publish: jest.fn().mockResolvedValue({
      success: false,
      errorCode: 'NOT_CONFIGURED',
      errorMessage: 'YouTube API is not configured',
    }),
    fetchAnalytics: jest.fn().mockResolvedValue({ views: 0, likes: 0 }),
  };

  const mockInstagramAdapter = {
    platform: 'INSTAGRAM',
    isConfigured: jest.fn().mockReturnValue(false),
    publish: jest.fn().mockResolvedValue({ success: false, errorCode: 'NOT_CONFIGURED' }),
  };

  const mockFacebookAdapter = {
    platform: 'FACEBOOK',
    isConfigured: jest.fn().mockReturnValue(false),
    publish: jest.fn().mockResolvedValue({ success: false, errorCode: 'NOT_CONFIGURED' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublishingService,
        EncryptionService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: TikTokAdapter, useValue: mockTikTokAdapter },
        { provide: YouTubeAdapter, useValue: mockYouTubeAdapter },
        { provide: InstagramAdapter, useValue: mockInstagramAdapter },
        { provide: FacebookAdapter, useValue: mockFacebookAdapter },
        { provide: getQueueToken('publishing-queue'), useValue: mockQueue },
        { provide: getQueueToken('analytics-queue'), useValue: mockQueue },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-encryption-secret-32-bytes!') },
        },
      ],
    }).compile();

    service = module.get<PublishingService>(PublishingService);
    prisma = module.get<PrismaService>(PrismaService);
    encryptionService = module.get<EncryptionService>(EncryptionService);
    jest.clearAllMocks();
  });

  describe('Account Management & Token Security', () => {
    it('should create account with encrypted access token and sanitize response', async () => {
      const mockCreated = {
        id: 'acc-1',
        platform: 'TIKTOK',
        accountName: 'My TikTok',
        accessToken: 'encrypted_token',
        refreshToken: null,
        status: 'ACTIVE',
      };
      mockPrismaService.platformAccount.create.mockResolvedValue(mockCreated);

      const res = await service.createAccount({
        platform: 'TIKTOK',
        accountName: 'My TikTok',
        accessToken: 'secret_token_123',
      });

      expect(mockPrismaService.platformAccount.create).toHaveBeenCalled();
      expect(res).not.toHaveProperty('accessToken');
      expect(res).toHaveProperty('hasAccessToken', true);
    });
  });

  describe('PublishJob Creation & Duplicate Protection', () => {
    it('should reject creation if active publish job already exists for same video and account', async () => {
      mockPrismaService.video.findUnique.mockResolvedValue({ id: 'v-1', title: 'Video 1' });
      mockPrismaService.platformAccount.findUnique.mockResolvedValue({ id: 'acc-1', platform: 'TIKTOK', accountName: 'TK' });
      mockPrismaService.publishJob.findFirst.mockResolvedValue({ id: 'job-existing', status: 'QUEUED' });

      await expect(
        service.createJob({ videoId: 'v-1', platformAccountId: 'acc-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create publish job and queue in BullMQ when valid', async () => {
      mockPrismaService.video.findUnique.mockResolvedValue({ id: 'v-1', title: 'Video 1' });
      mockPrismaService.platformAccount.findUnique.mockResolvedValue({ id: 'acc-1', platform: 'TIKTOK', accountName: 'TK' });
      mockPrismaService.publishJob.findFirst.mockResolvedValue(null);
      mockPrismaService.publishJob.create.mockResolvedValue({
        id: 'job-1',
        videoId: 'v-1',
        platformAccountId: 'acc-1',
        platform: 'TIKTOK',
        status: 'QUEUED',
      });

      const res = await service.createJob({ videoId: 'v-1', platformAccountId: 'acc-1' });
      expect(res.id).toEqual('job-1');
      expect(mockQueue.add).toHaveBeenCalledWith('publish-video', { jobId: 'job-1' }, expect.any(Object));
    });
  });

  describe('Job Execution & Status Updates', () => {
    it('should update job status to PUBLISHED upon adapter success', async () => {
      mockPrismaService.publishJob.findUnique.mockResolvedValue({
        id: 'job-1',
        videoId: 'v-1',
        platformAccountId: 'acc-1',
        platform: 'TIKTOK',
        status: 'QUEUED',
        title: 'Title',
        video: { videoObjectKey: 'v1.mp4', title: 'Video 1' },
        platformAccount: { id: 'acc-1', platform: 'TIKTOK', accessToken: 'token' },
      });

      await service.executePublishJob('job-1');

      expect(mockPrismaService.publishJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: expect.objectContaining({
          status: 'PUBLISHED',
          platformPostId: 'tiktok_post_123',
        }),
      });
    });
  });
});
