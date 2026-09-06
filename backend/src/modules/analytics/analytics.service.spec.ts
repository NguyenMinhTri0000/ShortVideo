import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../database/prisma.service';
import { PublishingService } from '../publishing/publishing.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  const mockPrismaService = {
    publishJob: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    postAnalytics: {
      create: jest.fn(),
    },
  };

  const mockPublishingService = {
    getAdapter: jest.fn().mockReturnValue({
      fetchAnalytics: jest.fn().mockResolvedValue({
        views: 5000,
        likes: 250,
        comments: 15,
        shares: 8,
        saves: 4,
        clicks: 0,
        engagementRate: 0.055,
      }),
    }),
  };

  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'analytics-job-1' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PublishingService, useValue: mockPublishingService },
        { provide: getQueueToken('analytics-queue'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    jest.clearAllMocks();
  });

  describe('collectSnapshotForJob', () => {
    it('should create new PostAnalytics snapshot record without overwriting previous snapshots', async () => {
      mockPrismaService.publishJob.findUnique.mockResolvedValue({
        id: 'job-1',
        status: 'PUBLISHED',
        platformPostId: 'tiktok_post_1',
        platform: 'TIKTOK',
        platformAccount: { id: 'acc-1' },
      });

      await service.collectSnapshotForJob('job-1');

      expect(mockPrismaService.postAnalytics.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          publishJobId: 'job-1',
          platformPostId: 'tiktok_post_1',
          views: BigInt(5000),
          likes: 250,
          comments: 15,
          shares: 8,
        }),
      });
    });
  });

  describe('getOverview & Platform Comparison', () => {
    it('should calculate aggregated views, likes, avg views, and platform breakdown', async () => {
      mockPrismaService.publishJob.findMany.mockResolvedValue([
        {
          id: 'job-1',
          videoId: 'v-1',
          title: 'Video A',
          platform: 'TIKTOK',
          video: { id: 'v-1', title: 'Video A' },
          analyticsSnapshots: [
            { views: BigInt(120000), likes: 8000, comments: 300, shares: 100 },
          ],
        },
        {
          id: 'job-2',
          videoId: 'v-1',
          title: 'Video A',
          platform: 'YOUTUBE',
          video: { id: 'v-1', title: 'Video A' },
          analyticsSnapshots: [
            { views: BigInt(80000), likes: 5000, comments: 200, shares: 50 },
          ],
        },
      ]);

      const overview = await service.getOverview();

      expect(overview.totalVideosPublished).toEqual(2);
      expect(overview.totalViews).toEqual(200000);
      expect(overview.totalLikes).toEqual(13000);
      expect(overview.avgViewsPerVideo).toEqual(100000);
      expect(overview.bestPerformingPlatform?.platform).toEqual('TIKTOK');
      expect(overview.platformComparison).toHaveLength(4);
    });
  });
});
