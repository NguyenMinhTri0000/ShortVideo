"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import {
  BarChart3,
  TrendingUp,
  Eye,
  Heart,
  MessageSquare,
  Share2,
  Filter,
  Trophy,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

interface OverviewData {
  totalVideosPublished: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalEngagement: number;
  avgViewsPerVideo: number;
  engagementRate: number;
  bestPerformingVideo: { videoId: string; title: string; views: number } | null;
  bestPerformingPlatform: { platform: string; views: number } | null;
  platformComparison: Array<{
    platform: string;
    videos: number;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    avgViews: number;
    engagementRate: number;
  }>;
}

interface TopVideo {
  jobId: string;
  videoId: string;
  title: string;
  platform: string;
  accountName: string;
  platformPostId?: string;
  platformUrl?: string;
  publishedAt?: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
}

interface InsightsData {
  totalPostsAnalyzed: number;
  totalViewsAnalyzed: number;
  overallAvgViews: number;
  topPerformingAngle: string;
  insights: Array<{
    contentType: string;
    totalPosts: number;
    totalViews: number;
    avgViews: number;
    performanceMultiplier: number;
    recommendation: string;
  }>;
  recommendedNextSteps: string[];
}

export default function AnalyticsDashboard() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [topVideos, setTopVideos] = useState<TopVideo[]>([]);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [dateRange, setDateRange] = useState<"today" | "last7days" | "last30days" | "last90days" | "custom">("last30days");
  const [sortBy, setSortBy] = useState<"views" | "likes" | "comments" | "shares" | "engagementRate">("views");

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedPlatform) params.append("platform", selectedPlatform);
      if (dateRange) params.append("dateRange", dateRange);

      const overviewRes = await api.get(`/analytics/overview?${params.toString()}`);
      
      const topParams = new URLSearchParams(params);
      topParams.append("sortBy", sortBy);
      topParams.append("limit", "5");
      const topRes = await api.get(`/analytics/top-performing?${topParams.toString()}`);

      const insightsRes = await api.get("/analytics/insights").catch(() => null);

      setOverview(overviewRes.data);
      setTopVideos(topRes.data || []);
      if (insightsRes?.data) setInsights(insightsRes.data);
    } catch (err: any) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedPlatform, dateRange, sortBy]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toLocaleString();
  };

  const getPlatformBadgeColor = (plat: string) => {
    switch (plat) {
      case "TIKTOK":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      case "YOUTUBE":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "INSTAGRAM":
        return "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20";
      case "FACEBOOK":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      default:
        return "bg-zinc-800 text-zinc-300 border-zinc-700";
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto text-zinc-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-violet-400" />
            Cross-Platform Video Analytics
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Historical analytics snapshots, performance comparison, and top content ranking across TikTok, YouTube, Instagram, and Facebook.
          </p>
        </div>

        <button
          onClick={fetchAnalytics}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:bg-zinc-800 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-violet-400" : ""}`} />
          Refresh Metrics
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-zinc-400 font-semibold">
          <Filter className="w-4 h-4 text-violet-400" />
          <span>Filters:</span>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-zinc-400">Date:</span>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
          >
            <option value="today">Today</option>
            <option value="last7days">Last 7 Days</option>
            <option value="last30days">Last 30 Days</option>
            <option value="last90days">Last 90 Days</option>
          </select>
        </div>

        {/* Platform Filter */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-zinc-400">Platform:</span>
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
          >
            <option value="">All Platforms</option>
            <option value="TIKTOK">TikTok</option>
            <option value="YOUTUBE">YouTube Shorts</option>
            <option value="INSTAGRAM">Instagram Reels</option>
            <option value="FACEBOOK">Facebook Reels</option>
          </select>
        </div>
      </div>

      {/* Smart Content Insights & Strategy Recommendations Banner */}
      {insights && insights.insights.length > 0 && (
        <div className="bg-gradient-to-r from-violet-950/40 via-purple-950/30 to-indigo-950/40 border border-violet-800/40 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-violet-400" />
              <h2 className="text-sm font-bold text-violet-200 uppercase tracking-wide">
                Smart Content Decision Engine
              </h2>
            </div>
            <span className="text-[10px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded border border-violet-500/30">
              AI Insight
            </span>
          </div>

          <p className="text-xs text-zinc-300">
            {insights.insights[0]?.recommendation || "Hệ thống đang theo dõi hiệu suất video để đưa ra gợi ý kịch bản tối ưu."}
          </p>

          {insights.recommendedNextSteps && insights.recommendedNextSteps.length > 0 && (
            <div className="bg-zinc-950/60 rounded-lg p-3 border border-violet-900/30 space-y-1">
              <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">Khuyến nghị tiếp theo:</span>
              <ul className="text-xs text-zinc-300 space-y-1 list-disc list-inside">
                {insights.recommendedNextSteps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-2">
          <div className="flex justify-between items-center text-xs text-zinc-400">
            <span>Total Views</span>
            <Eye className="w-4 h-4 text-violet-400" />
          </div>
          <p className="text-2xl font-bold text-zinc-100">{formatNumber(overview?.totalViews || 0)}</p>
          <p className="text-[10px] text-zinc-500 font-medium">Across all platforms</p>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-2">
          <div className="flex justify-between items-center text-xs text-zinc-400">
            <span>Total Likes</span>
            <Heart className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-zinc-100">{formatNumber(overview?.totalLikes || 0)}</p>
          <p className="text-[10px] text-zinc-500 font-medium">Reactions & double taps</p>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-2">
          <div className="flex justify-between items-center text-xs text-zinc-400">
            <span>Total Comments</span>
            <MessageSquare className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold text-zinc-100">{formatNumber(overview?.totalComments || 0)}</p>
          <p className="text-[10px] text-zinc-500 font-medium font-mono">User feedback</p>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-2">
          <div className="flex justify-between items-center text-xs text-zinc-400">
            <span>Total Shares</span>
            <Share2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-zinc-100">{formatNumber(overview?.totalShares || 0)}</p>
          <p className="text-[10px] text-zinc-500 font-medium">Organic viral reach</p>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-2 col-span-2 lg:col-span-1">
          <div className="flex justify-between items-center text-xs text-zinc-400">
            <span>Engagement Rate</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-zinc-100">
            {((overview?.engagementRate || 0) * 100).toFixed(2)}%
          </p>
          <p className="text-[10px] text-zinc-500 font-medium">Avg per view</p>
        </div>
      </div>

      {/* Platform Comparison */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-400" />
          Views & Performance by Platform
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 font-semibold">
                <th className="py-2.5 px-3">Platform</th>
                <th className="py-2.5 px-3">Videos Published</th>
                <th className="py-2.5 px-3">Total Views</th>
                <th className="py-2.5 px-3">Avg Views / Video</th>
                <th className="py-2.5 px-3">Likes</th>
                <th className="py-2.5 px-3">Comments</th>
                <th className="py-2.5 px-3">Shares</th>
                <th className="py-2.5 px-3">Engagement Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {(overview?.platformComparison || []).map((p) => (
                <tr key={p.platform} className="hover:bg-zinc-800/30">
                  <td className="py-3 px-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getPlatformBadgeColor(p.platform)}`}>
                      {p.platform === "YOUTUBE" ? "YOUTUBE SHORTS" : p.platform === "INSTAGRAM" ? "INSTAGRAM REELS" : p.platform === "FACEBOOK" ? "FACEBOOK REELS" : p.platform}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-semibold text-zinc-300">{p.videos}</td>
                  <td className="py-3 px-3 font-bold text-zinc-100">{formatNumber(p.views)}</td>
                  <td className="py-3 px-3 text-zinc-300">{formatNumber(p.avgViews)}</td>
                  <td className="py-3 px-3 text-zinc-300">{formatNumber(p.likes)}</td>
                  <td className="py-3 px-3 text-zinc-300">{formatNumber(p.comments)}</td>
                  <td className="py-3 px-3 text-zinc-300">{formatNumber(p.shares)}</td>
                  <td className="py-3 px-3 font-semibold text-emerald-400">
                    {(p.engagementRate * 100).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Performing Content Ranking */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            Top Performing Content Ranking
          </h2>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-200 focus:outline-none"
            >
              <option value="views">Views</option>
              <option value="likes">Likes</option>
              <option value="comments">Comments</option>
              <option value="shares">Shares</option>
              <option value="engagementRate">Engagement Rate</option>
            </select>
          </div>
        </div>

        {topVideos.length === 0 ? (
          <p className="text-xs text-zinc-500 italic">No published video analytics available yet.</p>
        ) : (
          <div className="space-y-3">
            {topVideos.map((item, index) => (
              <div
                key={item.jobId}
                className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-zinc-700 transition"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center border ${
                      index === 0
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : index === 1
                        ? "bg-zinc-400/20 text-zinc-300 border-zinc-400/40"
                        : index === 2
                        ? "bg-orange-600/20 text-orange-300 border-orange-600/40"
                        : "bg-zinc-800 text-zinc-400 border-zinc-700"
                    }`}
                  >
                    #{index + 1}
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-zinc-100">{item.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getPlatformBadgeColor(item.platform)}`}>
                        {item.platform}
                      </span>
                      <span className="text-[10px] text-zinc-400">Account: {item.accountName}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-xs">
                  <div className="text-right">
                    <p className="text-zinc-400 text-[10px]">Views</p>
                    <p className="font-bold text-zinc-100">{formatNumber(item.views)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-zinc-400 text-[10px]">Likes</p>
                    <p className="font-semibold text-rose-300">{formatNumber(item.likes)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-zinc-400 text-[10px]">Comments</p>
                    <p className="font-semibold text-cyan-300">{formatNumber(item.comments)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-zinc-400 text-[10px]">Engagement</p>
                    <p className="font-semibold text-emerald-400">{(item.engagementRate * 100).toFixed(1)}%</p>
                  </div>

                  {item.platformUrl && (
                    <a
                      href={item.platformUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition"
                      title="View Post"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
