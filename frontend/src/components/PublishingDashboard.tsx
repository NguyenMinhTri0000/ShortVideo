"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import {
  Share2,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  RefreshCw,
  Trash2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Video as VideoIcon,
  Send,
  Upload,
  Play,
  Film,
  FileVideo,
  Loader2,
} from "lucide-react";

interface PlatformAccount {
  id: string;
  platform: "TIKTOK" | "YOUTUBE" | "INSTAGRAM" | "FACEBOOK";
  accountName: string;
  accountId?: string;
  status: string;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  isConfigured: boolean;
  tokenExpiresAt?: string;
}

interface VideoItem {
  id: string;
  title: string;
  videoObjectKey: string;
  duration?: number;
  createdAt: string;
}

interface PublishJob {
  id: string;
  videoId: string;
  platform: string;
  title?: string;
  description?: string;
  caption?: string;
  scheduledAt?: string;
  publishedAt?: string;
  status: "DRAFT" | "SCHEDULED" | "QUEUED" | "PUBLISHING" | "PUBLISHED" | "FAILED" | "CANCELLED";
  platformPostId?: string;
  platformUrl?: string;
  errorMessage?: string;
  errorCode?: string;
  retryCount: number;
  createdAt: string;
  video?: { title: string };
  platformAccount?: { accountName: string };
}

export default function PublishingDashboard() {
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [jobs, setJobs] = useState<PublishJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form State
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("#affiliate #review #trending");
  const [privacyStatus, setPrivacyStatus] = useState("public");
  const [publishMode, setPublishMode] = useState<"NOW" | "SCHEDULE">("NOW");
  const [scheduledAt, setScheduledAt] = useState("");

  // Direct Video Selection & Upload State
  const [videoSourceTab, setVideoSourceTab] = useState<"select" | "upload">("select");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  // Connect Modal / Manual Account State
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectPlatform, setConnectPlatform] = useState<"TIKTOK" | "YOUTUBE" | "INSTAGRAM" | "FACEBOOK">("TIKTOK");
  const [manualAccountName, setManualAccountName] = useState("");
  const [manualAccessToken, setManualAccessToken] = useState("");

  const handleUploadFile = async (file: File) => {
    if (!file.type.startsWith("video/")) {
      setActionMessage({ type: "error", text: "Vui lòng chọn file video hợp lệ (MP4, MOV, WebM...)." });
      return;
    }
    setUploadingVideo(true);
    setUploadProgress(20);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name.replace(/\.[^/.]+$/, ""));

    try {
      setUploadProgress(60);
      const res = await api.post("/videos/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadProgress(100);
      const newVideo = res.data;
      if (newVideo && newVideo.id) {
        setVideos((prev) => [newVideo, ...prev]);
        setSelectedVideoId(newVideo.id);
        setTitle(newVideo.title || file.name);
        setActionMessage({
          type: "success",
          text: `Đã tải lên video "${newVideo.title}" thành công và tự động chọn để đăng!`,
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.response?.data?.message || "Tải video thất bại. Vui lòng thử lại.",
      });
    } finally {
      setUploadingVideo(false);
      setUploadProgress(0);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [accRes, vidRes, jobsRes] = await Promise.all([
        api.get("/publishing/accounts"),
        api.get("/videos"),
        api.get("/publishing/jobs"),
      ]);
      setAccounts(accRes.data || []);
      setVideos(vidRes.data || []);
      setJobs(jobsRes.data || []);

      if (vidRes.data && vidRes.data.length > 0 && !selectedVideoId) {
        setSelectedVideoId(vidRes.data[0].id);
        setTitle(vidRes.data[0].title);
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.message || "Failed to load publishing data." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const connectedId = params.get("accountConnected");
      const errorParam = params.get("error");
      if (connectedId) {
        setActionMessage({ type: "success", text: "Platform account connected successfully via OAuth!" });
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (errorParam) {
        setActionMessage({ type: "error", text: decodeURIComponent(errorParam) });
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const handleVideoSelect = (vidId: string) => {
    setSelectedVideoId(vidId);
    const v = videos.find((item) => item.id === vidId);
    if (v) {
      setTitle(v.title);
    }
  };

  const toggleAccountSelection = (accId: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(accId) ? prev.filter((id) => id !== accId) : [...prev, accId],
    );
  };

  const handleCreatePublishJobs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVideoId) {
      setActionMessage({ type: "error", text: "Please select a video to publish." });
      return;
    }
    if (selectedAccounts.length === 0) {
      setActionMessage({ type: "error", text: "Please select at least one platform account." });
      return;
    }
    if (publishMode === "SCHEDULE" && !scheduledAt) {
      setActionMessage({ type: "error", text: "Please specify a schedule date & time." });
      return;
    }

    setSubmitting(true);
    let successCount = 0;
    const errorMsgs: string[] = [];

    for (const accId of selectedAccounts) {
      try {
        await api.post("/publishing/jobs", {
          videoId: selectedVideoId,
          platformAccountId: accId,
          title,
          caption,
          hashtags: hashtags.split(" ").filter(Boolean),
          privacyStatus,
          scheduledAt: publishMode === "SCHEDULE" && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        });
        successCount++;
      } catch (err: any) {
        errorMsgs.push(err.response?.data?.message || `Failed for account ${accId}`);
      }
    }

    setSubmitting(false);

    if (successCount > 0) {
      setActionMessage({
        type: "success",
        text: `Successfully created ${successCount} publishing job(s)!`,
      });
      fetchData();
    } else {
      setActionMessage({ type: "error", text: errorMsgs.join(" | ") || "Failed to create publish jobs." });
    }
  };

  const handleConnectManualAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/publishing/accounts", {
        platform: connectPlatform,
        accountName: manualAccountName,
        accessToken: manualAccessToken,
      });
      setShowConnectModal(false);
      setManualAccountName("");
      setManualAccessToken("");
      setActionMessage({ type: "success", text: `Connected ${connectPlatform} account successfully.` });
      fetchData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.message || "Failed to connect account." });
    }
  };

  const handleStartOAuth = async (targetPlatform?: "TIKTOK" | "YOUTUBE" | "INSTAGRAM" | "FACEBOOK") => {
    const plat = targetPlatform || connectPlatform;
    try {
      const res = await api.get(`/publishing/accounts/${plat.toLowerCase()}/connect`);
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        setActionMessage({ type: "error", text: "Could not retrieve OAuth authorization URL." });
      }
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.response?.data?.message || `OAuth connect failed for ${plat}. Ensure API keys are configured.`,
      });
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm("Are you sure you want to disconnect this account?")) return;
    try {
      await api.delete(`/publishing/accounts/${id}`);
      setActionMessage({ type: "success", text: "Account disconnected." });
      fetchData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.message || "Failed to disconnect account." });
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await api.post(`/publishing/jobs/${jobId}/retry`);
      setActionMessage({ type: "success", text: "Publishing job re-queued for retry." });
      fetchData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.message || "Failed to retry job." });
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await api.post(`/publishing/jobs/${jobId}/cancel`);
      setActionMessage({ type: "success", text: "Scheduled job cancelled." });
      fetchData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.message || "Failed to cancel job." });
    }
  };

  const scheduledJobs = jobs.filter((j) => j.status === "SCHEDULED" || j.status === "QUEUED");
  const publishedJobs = jobs.filter((j) => j.status === "PUBLISHED");
  const failedJobs = jobs.filter((j) => j.status === "FAILED");

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
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-indigo-400 flex items-center gap-2">
            <Share2 className="w-6 h-6 text-violet-400" />
            Multi-Platform Video Publishing
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Schedule and auto-publish generated short videos across TikTok, YouTube Shorts, Instagram Reels, and Facebook Reels.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:bg-zinc-800 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-violet-400" : ""}`} />
          Refresh
        </button>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-xs ${
            actionMessage.type === "success"
              ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
              : "bg-rose-950/40 border-rose-800/60 text-rose-300"
          }`}
        >
          {actionMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* SECTION 1: Connected Accounts */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            Connected Platform Accounts
          </h2>
          <button
            onClick={() => setShowConnectModal(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Connect Account
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(["TIKTOK", "YOUTUBE", "INSTAGRAM", "FACEBOOK"] as const).map((plat) => {
            const accList = accounts.filter((a) => a.platform === plat);
            const hasConnected = accList.length > 0;

            return (
              <div
                key={plat}
                className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-3 relative overflow-hidden group"
              >
                <div className="flex justify-between items-start">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getPlatformBadgeColor(plat)}`}>
                    {plat === "YOUTUBE" ? "YOUTUBE SHORTS" : plat === "INSTAGRAM" ? "INSTAGRAM REELS" : plat === "FACEBOOK" ? "FACEBOOK REELS" : plat}
                  </span>
                  <span
                    className={`text-[10px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded-full ${
                      hasConnected
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {hasConnected ? "CONNECTED" : "NOT CONNECTED"}
                  </span>
                </div>

                {hasConnected ? (
                  <div className="space-y-2 pt-1">
                    {accList.map((acc) => (
                      <div key={acc.id} className="flex justify-between items-center text-xs bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800">
                        <div>
                          <p className="font-semibold text-zinc-200">{acc.accountName}</p>
                          <p className="text-[10px] text-zinc-500 font-mono">Tokens: Safe & Encrypted</p>
                        </div>
                        <button
                          onClick={() => handleDeleteAccount(acc.id)}
                          className="text-zinc-500 hover:text-rose-400 transition"
                          title="Disconnect Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 py-1">
                    <p className="text-xs text-zinc-500 italic">No account connected for {plat}.</p>
                    <button
                      type="button"
                      onClick={() => {
                        if (plat === "YOUTUBE") {
                          handleStartOAuth("YOUTUBE");
                        } else {
                          setConnectPlatform(plat);
                          setShowConnectModal(true);
                        }
                      }}
                      className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition shadow-sm ${
                        plat === "YOUTUBE"
                          ? "bg-red-600 hover:bg-red-500 text-white"
                          : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                      }`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {plat === "YOUTUBE" ? "Sign in YouTube Account" : `Connect ${plat}`}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: Create Publishing Job */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-6">
        <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2 border-b border-zinc-800 pb-3">
          <Send className="w-4 h-4 text-violet-400" />
          Create Publishing Job
        </h2>

        <form onSubmit={handleCreatePublishJobs} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Select Video & Select Accounts */}
            <div className="space-y-4">
              {/* Select or Upload Video Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <VideoIcon className="w-3.5 h-3.5 text-violet-400" />
                    Video to Publish
                  </label>

                  {/* Tabs */}
                  <div className="flex bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setVideoSourceTab("select")}
                      className={`px-2.5 py-1 rounded-md transition font-medium flex items-center gap-1 ${
                        videoSourceTab === "select"
                          ? "bg-violet-600 text-white shadow-sm"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <Film className="w-3 h-3" />
                      Select Video
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoSourceTab("upload")}
                      className={`px-2.5 py-1 rounded-md transition font-medium flex items-center gap-1 ${
                        videoSourceTab === "upload"
                          ? "bg-violet-600 text-white shadow-sm"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <Upload className="w-3 h-3" />
                      Upload File
                    </button>
                  </div>
                </div>

                {videoSourceTab === "select" ? (
                  <div>
                    <select
                      value={selectedVideoId}
                      onChange={(e) => handleVideoSelect(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
                    >
                      {videos.length === 0 ? (
                        <option value="">No generated or uploaded videos found</option>
                      ) : (
                        videos.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.title} ({new Date(v.createdAt).toLocaleDateString()})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                ) : (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-xl p-4 text-center transition ${
                      dragActive
                        ? "border-violet-500 bg-violet-950/20"
                        : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700"
                    }`}
                  >
                    <input
                      type="file"
                      accept="video/*"
                      id="video-file-input"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleUploadFile(e.target.files[0]);
                        }
                      }}
                    />
                    {uploadingVideo ? (
                      <div className="py-3 space-y-2 flex flex-col items-center justify-center">
                        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
                        <p className="text-xs text-zinc-300 font-medium">Uploading video file...</p>
                        <div className="w-48 bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-violet-500 h-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <label htmlFor="video-file-input" className="cursor-pointer block space-y-1.5 py-1">
                        <Upload className="w-6 h-6 mx-auto text-violet-400" />
                        <p className="text-xs font-semibold text-zinc-200">
                          Click to select or drop video file here
                        </p>
                        <p className="text-[10px] text-zinc-500">
                          Supports MP4, MOV, WebM (Auto-selects upon upload)
                        </p>
                      </label>
                    )}
                  </div>
                )}

                {/* Selected Video Live Preview Player */}
                {selectedVideoId && (
                  <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileVideo className="w-4 h-4 text-violet-400" />
                        <span className="text-xs font-semibold text-zinc-200 truncate max-w-[200px]">
                          {videos.find((v) => v.id === selectedVideoId)?.title || "Selected Video"}
                        </span>
                      </div>
                      <span className="text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded font-mono">
                        9:16 Short
                      </span>
                    </div>

                    <div className="overflow-hidden rounded-lg bg-black border border-zinc-800 flex justify-center">
                      <video
                        key={selectedVideoId}
                        controls
                        preload="metadata"
                        src={`/api/videos/${selectedVideoId}/stream`}
                        className="max-h-48 w-auto rounded-lg"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Target Platforms & Accounts
                </label>
                {accounts.length === 0 ? (
                  <p className="text-xs text-amber-400 bg-amber-950/20 border border-amber-800/40 p-3 rounded-lg">
                    No platform accounts connected yet. Please connect an account above first.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {accounts.map((acc) => {
                      const isSelected = selectedAccounts.includes(acc.id);
                      return (
                        <div
                          key={acc.id}
                          onClick={() => toggleAccountSelection(acc.id)}
                          className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition text-xs ${
                            isSelected
                              ? "bg-violet-950/30 border-violet-500/50 text-violet-200"
                              : "bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded border-zinc-700 text-violet-600 focus:ring-0"
                            />
                            <div>
                              <span className="font-semibold text-zinc-200">{acc.accountName}</span>
                              <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded border ${getPlatformBadgeColor(acc.platform)}`}>
                                {acc.platform}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Metadata & Schedule Settings */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Post Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter post title..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Caption / Description
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={2}
                  placeholder="Write engaging caption for your short video..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Hashtags
                  </label>
                  <input
                    type="text"
                    value={hashtags}
                    onChange={(e) => setHashtags(e.target.value)}
                    placeholder="#tag1 #tag2"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Privacy Status
                  </label>
                  <select
                    value={privacyStatus}
                    onChange={(e) => setPrivacyStatus(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                    <option value="unlisted">Unlisted</option>
                  </select>
                </div>
              </div>

              {/* Schedule Mode */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-zinc-300 mb-2">
                  Publishing Schedule
                </label>
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="publishMode"
                      checked={publishMode === "NOW"}
                      onChange={() => setPublishMode("NOW")}
                      className="text-violet-600 focus:ring-0"
                    />
                    <span>Publish Now</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="publishMode"
                      checked={publishMode === "SCHEDULE"}
                      onChange={() => setPublishMode("SCHEDULE")}
                      className="text-violet-600 focus:ring-0"
                    />
                    <span>Schedule for Later</span>
                  </label>
                </div>

                {publishMode === "SCHEDULE" && (
                  <div className="mt-3">
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-zinc-800 pt-4">
            <button
              type="submit"
              disabled={submitting || accounts.length === 0}
              className="flex items-center gap-2 font-semibold text-xs px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/20 disabled:opacity-50 transition"
            >
              {submitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : publishMode === "SCHEDULE" ? (
                <Calendar className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {publishMode === "SCHEDULE" ? "Schedule Publishing Job" : "Publish Now"}
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 3: Scheduled & Queued Posts */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          Scheduled & Queued Posts ({scheduledJobs.length})
        </h2>

        {scheduledJobs.length === 0 ? (
          <p className="text-xs text-zinc-500 italic">No posts currently scheduled or queued.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 font-semibold">
                  <th className="py-2.5 px-3">Video Title</th>
                  <th className="py-2.5 px-3">Platform</th>
                  <th className="py-2.5 px-3">Account</th>
                  <th className="py-2.5 px-3">Scheduled At</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {scheduledJobs.map((j) => (
                  <tr key={j.id} className="hover:bg-zinc-800/30">
                    <td className="py-3 px-3 font-medium text-zinc-200">{j.title || j.video?.title}</td>
                    <td className="py-3 px-3">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${getPlatformBadgeColor(j.platform)}`}>
                        {j.platform}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-zinc-300">{j.platformAccount?.accountName || "Account"}</td>
                    <td className="py-3 px-3 text-zinc-400">
                      {j.scheduledAt ? new Date(j.scheduledAt).toLocaleString() : "Immediate"}
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {j.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleCancelJob(j.id)}
                        className="text-zinc-500 hover:text-rose-400 text-xs font-semibold"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 4: Published Posts */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          Published Posts ({publishedJobs.length})
        </h2>

        {publishedJobs.length === 0 ? (
          <p className="text-xs text-zinc-500 italic">No published posts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 font-semibold">
                  <th className="py-2.5 px-3">Video Title</th>
                  <th className="py-2.5 px-3">Platform</th>
                  <th className="py-2.5 px-3">Published At</th>
                  <th className="py-2.5 px-3">Platform Post ID</th>
                  <th className="py-2.5 px-3 text-right">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {publishedJobs.map((j) => (
                  <tr key={j.id} className="hover:bg-zinc-800/30">
                    <td className="py-3 px-3 font-medium text-zinc-200">{j.title || j.video?.title}</td>
                    <td className="py-3 px-3">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${getPlatformBadgeColor(j.platform)}`}>
                        {j.platform}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-zinc-400">
                      {j.publishedAt ? new Date(j.publishedAt).toLocaleString() : "N/A"}
                    </td>
                    <td className="py-3 px-3 text-zinc-400 font-mono text-[11px]">{j.platformPostId || "N/A"}</td>
                    <td className="py-3 px-3 text-right">
                      {j.platformUrl ? (
                        <a
                          href={j.platformUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-violet-400 hover:text-violet-300 font-semibold"
                        >
                          View Post <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-zinc-600">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 5: Failed Posts */}
      {failedJobs.length > 0 && (
        <div className="bg-zinc-900/60 border border-rose-900/40 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-rose-300 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-400" />
            Failed Publishing Attempts ({failedJobs.length})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 font-semibold">
                  <th className="py-2.5 px-3">Video Title</th>
                  <th className="py-2.5 px-3">Platform</th>
                  <th className="py-2.5 px-3">Error Code</th>
                  <th className="py-2.5 px-3">Error Message</th>
                  <th className="py-2.5 px-3">Retries</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {failedJobs.map((j) => (
                  <tr key={j.id} className="hover:bg-zinc-800/30">
                    <td className="py-3 px-3 font-medium text-zinc-200">{j.title || j.video?.title}</td>
                    <td className="py-3 px-3">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${getPlatformBadgeColor(j.platform)}`}>
                        {j.platform}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-rose-400 font-mono text-[11px]">{j.errorCode || "FAILED"}</td>
                    <td className="py-3 px-3 text-zinc-300 max-w-xs truncate">{j.errorMessage}</td>
                    <td className="py-3 px-3 text-zinc-400">{j.retryCount}</td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleRetryJob(j.id)}
                        className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition"
                      >
                        Retry Now
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONNECT ACCOUNT MODAL */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-base font-bold text-zinc-100">Connect Platform Account</h3>
            <form onSubmit={handleConnectManualAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Platform</label>
                <select
                  value={connectPlatform}
                  onChange={(e) => setConnectPlatform(e.target.value as any)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
                >
                  <option value="TIKTOK">TikTok</option>
                  <option value="YOUTUBE">YouTube Shorts</option>
                  <option value="INSTAGRAM">Instagram Reels</option>
                  <option value="FACEBOOK">Facebook Reels</option>
                </select>
              </div>

              <div className="bg-violet-950/40 border border-violet-800/40 rounded-lg p-3 space-y-2">
                <p className="text-xs text-violet-200 font-medium">Automatic Connection via OAuth 2.0 (Recommended)</p>
                <button
                  type="button"
                  onClick={() => handleStartOAuth()}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition shadow-md"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Sign in & Connect {connectPlatform} Account
                </button>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-zinc-800"></div>
                <span className="flex-shrink mx-2 text-[10px] text-zinc-500 uppercase font-semibold">Or Manual Entry (Testing)</span>
                <div className="flex-grow border-t border-zinc-800"></div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Account Display Name</label>
                <input
                  type="text"
                  required
                  value={manualAccountName}
                  onChange={(e) => setManualAccountName(e.target.value)}
                  placeholder="e.g. My TikTok Channel"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Access Token (Optional for API testing)
                </label>
                <input
                  type="password"
                  value={manualAccessToken}
                  onChange={(e) => setManualAccessToken(e.target.value)}
                  placeholder="Leave empty or paste platform bearer token"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500 font-mono"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  Tokens are automatically encrypted at rest in the backend.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs text-white font-semibold"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
