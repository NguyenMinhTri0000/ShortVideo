import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { PublishingService } from '../publishing/publishing.service';
import { PlatformType } from '../publishing/adapters/platform-adapter.interface';

export interface AnalyticsFilterDto {
  platform?: string;
  videoId?: string;
  dateRange?: 'today' | 'last7days' | 'last30days' | 'last90days' | 'custom';
  startDate?: string;
  endDate?: string;
  sortBy?: 'views' | 'likes' | 'comments' | 'shares' | 'engagementRate';
  limit?: number;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publishingService: PublishingService,
    @InjectQueue('analytics-queue') private readonly analyticsQueue: Queue,
  ) {}

  private getDateFilter(dto?: AnalyticsFilterDto) {
    if (!dto?.dateRange) return undefined;

    const now = new Date();
    let start: Date;

    switch (dto.dateRange) {
      case 'today':
        start = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'last7days':
        start = new Date(Date.now() - 7 * 24 * 3600 * 1000);
        break;
      case 'last30days':
        start = new Date(Date.now() - 30 * 24 * 3600 * 1000);
        break;
      case 'last90days':
        start = new Date(Date.now() - 90 * 24 * 3600 * 1000);
        break;
      case 'custom':
        start = dto.startDate ? new Date(dto.startDate) : new Date(0);
        break;
      default:
        return undefined;
    }

    const end =
      dto.dateRange === 'custom' && dto.endDate
        ? new Date(dto.endDate)
        : new Date();
    return { gte: start, lte: end };
  }

  // --- SNAPSHOT COLLECTION ---

  async collectSnapshotForJob(publishJobId: string): Promise<void> {
    const job = await this.prisma.publishJob.findUnique({
      where: { id: publishJobId },
      include: { platformAccount: true },
    });

    if (!job || job.status !== 'PUBLISHED' || !job.platformPostId) {
      this.logger.warn(
        `Skipping analytics collection for job ${publishJobId}: Job not published or missing post ID.`,
      );
      return;
    }

    try {
      const adapter = this.publishingService.getAdapter(
        job.platform as PlatformType,
      );
      const metrics = await adapter.fetchAnalytics(
        job.platformAccount,
        job.platformPostId,
      );

      await this.prisma.postAnalytics.create({
        data: {
          publishJobId: job.id,
          platformPostId: job.platformPostId,
          collectedAt: new Date(),
          views: BigInt(metrics.views || 0),
          likes: metrics.likes || 0,
          comments: metrics.comments || 0,
          shares: metrics.shares || 0,
          saves: metrics.saves || 0,
          clicks: metrics.clicks || 0,
          watchTime: metrics.watchTime,
          averageWatchTime: metrics.averageWatchTime,
          completionRate: metrics.completionRate,
          engagementRate: metrics.engagementRate,
          rawMetadata: metrics.rawMetadata || {},
        },
      });

      this.logger.log(
        `Created analytics snapshot for job ${publishJobId} (Views: ${metrics.views}, Likes: ${metrics.likes})`,
      );
    } catch (error: any) {
      this.logger.error(
        `Error collecting analytics snapshot for job ${publishJobId}: ${error.message}`,
        error.stack,
      );
    }
  }

  async scheduleNextSnapshot(publishJobId: string, currentInterval: string) {
    const intervals: Record<string, { nextLabel: string; delayMs: number }> = {
      '1h': { nextLabel: '6h', delayMs: 5 * 3600 * 1000 },
      '6h': { nextLabel: '24h', delayMs: 18 * 3600 * 1000 },
      '24h': { nextLabel: '48h', delayMs: 24 * 3600 * 1000 },
      '48h': { nextLabel: '7d', delayMs: 5 * 24 * 3600 * 1000 },
    };

    const next = intervals[currentInterval];
    if (next) {
      await this.analyticsQueue.add(
        'collect-analytics',
        { publishJobId, intervalLabel: next.nextLabel },
        { delay: next.delayMs },
      );
    }
  }

  // --- ANALYTICS APIS ---

  async getOverview(dto?: AnalyticsFilterDto) {
    const dateFilter = this.getDateFilter(dto);

    const whereJob: any = { status: 'PUBLISHED' };
    if (dto?.platform) whereJob.platform = dto.platform;
    if (dto?.videoId) whereJob.videoId = dto.videoId;

    const publishedJobs = await this.prisma.publishJob.findMany({
      where: whereJob,
      include: {
        video: true,
        analyticsSnapshots: {
          where: dateFilter ? { collectedAt: dateFilter } : undefined,
          orderBy: { collectedAt: 'desc' },
          take: 1, // latest snapshot per post
        },
      },
    });

    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;

    const platformStats: Record<
      string,
      {
        videos: number;
        views: number;
        likes: number;
        comments: number;
        shares: number;
      }
    > = {
      TIKTOK: { videos: 0, views: 0, likes: 0, comments: 0, shares: 0 },
      YOUTUBE: { videos: 0, views: 0, likes: 0, comments: 0, shares: 0 },
      INSTAGRAM: { videos: 0, views: 0, likes: 0, comments: 0, shares: 0 },
      FACEBOOK: { videos: 0, views: 0, likes: 0, comments: 0, shares: 0 },
    };

    let bestVideo: { videoId: string; title: string; views: number } | null =
      null;
    let maxVideoViews = -1;

    const videoViewsMap: Record<string, { title: string; views: number }> = {};

    for (const job of publishedJobs) {
      const latestSnapshot = job.analyticsSnapshots[0];
      const views = latestSnapshot ? Number(latestSnapshot.views) : 0;
      const likes = latestSnapshot ? latestSnapshot.likes : 0;
      const comments = latestSnapshot ? latestSnapshot.comments : 0;
      const shares = latestSnapshot ? latestSnapshot.shares : 0;

      totalViews += views;
      totalLikes += likes;
      totalComments += comments;
      totalShares += shares;

      if (!platformStats[job.platform]) {
        platformStats[job.platform] = {
          videos: 0,
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
        };
      }
      platformStats[job.platform].videos += 1;
      platformStats[job.platform].views += views;
      platformStats[job.platform].likes += likes;
      platformStats[job.platform].comments += comments;
      platformStats[job.platform].shares += shares;

      if (!videoViewsMap[job.videoId]) {
        videoViewsMap[job.videoId] = {
          title: job.title || job.video.title,
          views: 0,
        };
      }
      videoViewsMap[job.videoId].views += views;

      if (videoViewsMap[job.videoId].views > maxVideoViews) {
        maxVideoViews = videoViewsMap[job.videoId].views;
        bestVideo = {
          videoId: job.videoId,
          title: videoViewsMap[job.videoId].title,
          views: maxVideoViews,
        };
      }
    }

    let bestPlatform: string | null = null;
    let maxPlatformViews = -1;
    for (const [p, stats] of Object.entries(platformStats)) {
      if (stats.views > maxPlatformViews && stats.videos > 0) {
        maxPlatformViews = stats.views;
        bestPlatform = p;
      }
    }

    const totalVideosPublished = publishedJobs.length;
    const avgViewsPerVideo =
      totalVideosPublished > 0
        ? Math.round(totalViews / totalVideosPublished)
        : 0;
    const engagementRate =
      totalViews > 0
        ? (totalLikes + totalComments + totalShares) / totalViews
        : 0;

    return {
      totalVideosPublished,
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      totalEngagement: totalLikes + totalComments + totalShares,
      avgViewsPerVideo,
      engagementRate,
      bestPerformingVideo: bestVideo,
      bestPerformingPlatform: bestPlatform
        ? { platform: bestPlatform, views: maxPlatformViews }
        : null,
      platformComparison: Object.entries(platformStats).map(
        ([platform, stats]) => ({
          platform,
          videos: stats.videos,
          views: stats.views,
          likes: stats.likes,
          comments: stats.comments,
          shares: stats.shares,
          avgViews:
            stats.videos > 0 ? Math.round(stats.views / stats.videos) : 0,
          engagementRate:
            stats.views > 0
              ? (stats.likes + stats.comments + stats.shares) / stats.views
              : 0,
        }),
      ),
    };
  }

  async getTopPerforming(dto?: AnalyticsFilterDto) {
    const limit = dto?.limit || 10;
    const dateFilter = this.getDateFilter(dto);

    const whereJob: any = { status: 'PUBLISHED' };
    if (dto?.platform) whereJob.platform = dto.platform;
    if (dto?.videoId) whereJob.videoId = dto.videoId;

    const publishedJobs = await this.prisma.publishJob.findMany({
      where: whereJob,
      include: {
        video: true,
        platformAccount: { select: { platform: true, accountName: true } },
        analyticsSnapshots: {
          where: dateFilter ? { collectedAt: dateFilter } : undefined,
          orderBy: { collectedAt: 'desc' },
          take: 1,
        },
      },
    });

    const items = publishedJobs.map((job) => {
      const snap = job.analyticsSnapshots[0];
      const views = snap ? Number(snap.views) : 0;
      const likes = snap ? snap.likes : 0;
      const comments = snap ? snap.comments : 0;
      const shares = snap ? snap.shares : 0;
      const engagementRate =
        views > 0 ? (likes + comments + shares) / views : 0;

      return {
        jobId: job.id,
        videoId: job.videoId,
        title: job.title || job.video.title,
        platform: job.platform,
        accountName: job.platformAccount.accountName,
        platformPostId: job.platformPostId,
        platformUrl: job.platformUrl,
        publishedAt: job.publishedAt,
        views,
        likes,
        comments,
        shares,
        engagementRate,
      };
    });

    const sortBy = dto?.sortBy || 'views';
    items.sort((a, b) => b[sortBy] - a[sortBy]);

    return items.slice(0, limit);
  }

  async getVideoAnalytics(videoId: string) {
    const jobs = await this.prisma.publishJob.findMany({
      where: { videoId },
      include: {
        platformAccount: { select: { platform: true, accountName: true } },
        analyticsSnapshots: {
          orderBy: { collectedAt: 'asc' },
        },
      },
    });

    if (jobs.length === 0) {
      throw new NotFoundException(
        `No publishing records found for video ID ${videoId}`,
      );
    }

    return jobs.map((job) => ({
      jobId: job.id,
      platform: job.platform,
      accountName: job.platformAccount.accountName,
      platformPostId: job.platformPostId,
      platformUrl: job.platformUrl,
      publishedAt: job.publishedAt,
      status: job.status,
      snapshots: job.analyticsSnapshots.map((s) => ({
        id: s.id,
        collectedAt: s.collectedAt,
        views: Number(s.views),
        likes: s.likes,
        comments: s.comments,
        shares: s.shares,
        saves: s.saves,
        engagementRate: s.engagementRate,
      })),
    }));
  }

  async getPostAnalytics(publishJobId: string) {
    const job = await this.prisma.publishJob.findUnique({
      where: { id: publishJobId },
      include: {
        video: true,
        platformAccount: { select: { platform: true, accountName: true } },
        analyticsSnapshots: {
          orderBy: { collectedAt: 'asc' },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(
        `Publish job with ID ${publishJobId} not found.`,
      );
    }

    return {
      jobId: job.id,
      videoId: job.videoId,
      videoTitle: job.video.title,
      platform: job.platform,
      accountName: job.platformAccount.accountName,
      platformPostId: job.platformPostId,
      platformUrl: job.platformUrl,
      publishedAt: job.publishedAt,
      snapshots: job.analyticsSnapshots.map((s) => ({
        id: s.id,
        collectedAt: s.collectedAt,
        views: Number(s.views),
        likes: s.likes,
        comments: s.comments,
        shares: s.shares,
        saves: s.saves,
        engagementRate: s.engagementRate,
      })),
    };
  }

  async getContentInsights() {
    const publishedJobs = await this.prisma.publishJob.findMany({
      where: { status: 'PUBLISHED' },
      include: {
        video: {
          include: {
            idea: {
              include: {
                product: {
                  include: {
                    contentIdeas: true,
                  },
                },
              },
            },
          },
        },
        analyticsSnapshots: {
          orderBy: { collectedAt: 'desc' },
          take: 1,
        },
      },
    });

    const angleStats: Record<
      string,
      { views: number; count: number; likes: number }
    > = {};
    let totalViews = 0;
    let totalPosts = 0;

    for (const job of publishedJobs) {
      const snap = job.analyticsSnapshots[0];
      const views = snap ? Number(snap.views) : 0;
      const likes = snap ? snap.likes : 0;
      totalViews += views;
      totalPosts++;

      // Match angle/contentType from associated idea or product
      const idea = job.video?.idea;
      const matchedIdea = idea?.product?.contentIdeas.find(
        (ci) =>
          ci.title === idea.title ||
          idea.description?.includes(ci.marketingAngle),
      );

      const angleKey =
        matchedIdea?.contentType ||
        matchedIdea?.marketingAngle ||
        'product_review';

      if (!angleStats[angleKey]) {
        angleStats[angleKey] = { views: 0, count: 0, likes: 0 };
      }
      angleStats[angleKey].views += views;
      angleStats[angleKey].count += 1;
      angleStats[angleKey].likes += likes;
    }

    const overallAvgViews = totalPosts > 0 ? totalViews / totalPosts : 0;

    const angleInsights = Object.entries(angleStats).map(([angle, stats]) => {
      const avgViews =
        stats.count > 0 ? Math.round(stats.views / stats.count) : 0;
      const performanceMultiplier =
        overallAvgViews > 0
          ? Number((avgViews / overallAvgViews).toFixed(2))
          : 1;

      return {
        contentType: angle,
        totalPosts: stats.count,
        totalViews: stats.views,
        avgViews,
        performanceMultiplier,
        recommendation:
          performanceMultiplier >= 1.2
            ? `Góc nhìn "${angle}" đạt trung bình ${avgViews.toLocaleString()} lượt xem (${Math.round((performanceMultiplier - 1) * 100)}% cao hơn trung bình). Khuyên dùng tiếp tục nhân bản!`
            : `Góc nhìn "${angle}" đang đạt mức hiệu suất bình thường (${avgViews.toLocaleString()} views/video).`,
      };
    });

    angleInsights.sort((a, b) => b.avgViews - a.avgViews);

    const topAngle = angleInsights[0];

    return {
      totalPostsAnalyzed: totalPosts,
      totalViewsAnalyzed: totalViews,
      overallAvgViews: Math.round(overallAvgViews),
      topPerformingAngle: topAngle ? topAngle.contentType : 'product_review',
      insights: angleInsights,
      recommendedNextSteps: topAngle
        ? [
            `Tập trung tạo thêm 3-5 video mới sử dụng định dạng nội dung "${topAngle.contentType}".`,
            `Thử nghiệm kết hợp Hook mở đầu của video hot nhất với sản phẩm cùng danh mục.`,
          ]
        : [
            'Tiếp tục đăng thêm video để hệ thống tích lũy đủ dữ liệu phân tích.',
          ],
    };
  }
}
