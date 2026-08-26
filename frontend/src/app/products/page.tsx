"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import Link from "next/link";
import {
  ShoppingBag,
  Plus,
  Trash2,
  Edit3,
  Video,
  ExternalLink,
  Sparkles,
  Loader2,
  DollarSign,
  Tag,
  Layers,
  Image as ImageIcon,
  Search,
  Globe,
  CheckCircle2,
  AlertCircle,
  Target,
  Zap,
  Users,
  TrendingUp,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";

type Product = {
  id: string;
  name: string;
  description?: string;
  price?: string;
  currency: string;
  affiliateUrl: string;
  features: string[];
  benefits: string[];
  targetAudience?: string;
  images: string[];
  createdAt: string;
  sourceUrl?: string;
  researchStatus?: string;
  category?: string;
  usp?: string[];
  painPoints?: string[];
  marketingAngles?: MarketingAngle[];
  _count?: {
    ideas: number;
    jobs: number;
  };
};

type MarketingAngle = {
  title: string;
  description: string;
  hook: string;
};

type ResearchResult = {
  success: boolean;
  product?: Product;
  error?: {
    code: string;
    message: string;
  };
};

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [generatingProductId, setGeneratingProductId] = useState<string | null>(null);

  // Research state
  const [researchUrl, setResearchUrl] = useState("");
  const [researchResult, setResearchResult] = useState<ResearchResult | null>(null);
  const [isResearchPanelExpanded, setIsResearchPanelExpanded] = useState(true);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("VND");
  const [affiliateUrl, setAffiliateUrl] = useState("");
  const [featuresText, setFeaturesText] = useState("");
  const [benefitsText, setBenefitsText] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [imagesText, setImagesText] = useState("");

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => api.get("/products").then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (newProduct: any) => api.post("/products", newProduct),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsCreateModalOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const researchMutation = useMutation({
    mutationFn: (url: string) =>
      api.post("/product-research", { url }).then((res) => res.data as ResearchResult),
    onSuccess: (data) => {
      setResearchResult(data);
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["products"] });
      }
    },
    onError: (error: any) => {
      setResearchResult({
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: error?.response?.data?.message || error?.message || "Lỗi kết nối. Vui lòng thử lại.",
        },
      });
    },
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setPrice("");
    setCurrency("VND");
    setAffiliateUrl("");
    setFeaturesText("");
    setBenefitsText("");
    setTargetAudience("");
    setImagesText("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !affiliateUrl.trim()) return;

    const features = featuresText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const benefits = benefitsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const images = imagesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      price: price.trim() || undefined,
      currency: currency || "VND",
      affiliateUrl: affiliateUrl.trim(),
      features,
      benefits,
      targetAudience: targetAudience.trim() || undefined,
      images,
    });
  };

  const handleGenerateVideo = async (productId: string) => {
    setGeneratingProductId(productId);
    try {
      const res = await api.post(`/products/${productId}/generate-video`, {
        aspect_ratio: "9:16",
        voice_name: "vi-VN-HoaiMyNeural",
      });
      if (res.data?.job?.id) {
        window.location.href = `/jobs/${res.data.job.id}`;
      } else {
        window.location.href = "/jobs";
      }
    } catch (error) {
      console.error("Failed to generate video for product:", error);
      alert("Không thể khởi tạo job tạo video. Vui lòng kiểm tra lại cấu hình backend.");
    } finally {
      setGeneratingProductId(null);
    }
  };

  const handleResearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!researchUrl.trim()) return;
    setResearchResult(null);
    researchMutation.mutate(researchUrl.trim());
  };

  const clearResearch = () => {
    setResearchUrl("");
    setResearchResult(null);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-violet-400" />
            Sản Phẩm Affiliate
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Quản lý thông tin sản phẩm bán hàng & tự động sinh Short Video 9:16 bằng AI
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium text-sm hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-violet-500/20"
        >
          <Plus className="w-4 h-4" />
          Thêm Sản Phẩm Mới
        </button>
      </div>

      {/* ============================================================== */}
      {/* PRODUCT RESEARCH SECTION */}
      {/* ============================================================== */}
      <div className="bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-indigo-950/30 border border-zinc-800/80 rounded-xl overflow-hidden">
        {/* Research Header */}
        <button
          onClick={() => setIsResearchPanelExpanded(!isResearchPanelExpanded)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-zinc-800/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <h2 className="text-base font-semibold text-zinc-100">
                Nghiên Cứu Sản Phẩm từ URL
              </h2>
              <p className="text-xs text-zinc-500">
                Dán link sản phẩm → AI tự động phân tích & trích xuất thông tin
              </p>
            </div>
          </div>
          {isResearchPanelExpanded ? (
            <ChevronUp className="w-5 h-5 text-zinc-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-zinc-500" />
          )}
        </button>

        {isResearchPanelExpanded && (
          <div className="px-6 pb-6 space-y-5 border-t border-zinc-800/60">
            {/* URL Input Form */}
            <form onSubmit={handleResearch} className="flex gap-3 pt-5">
              <div className="flex-1 relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="url"
                  value={researchUrl}
                  onChange={(e) => setResearchUrl(e.target.value)}
                  placeholder="https://shopee.vn/product/... hoặc bất kỳ URL sản phẩm nào"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-10 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  disabled={researchMutation.isPending}
                />
                {researchUrl && (
                  <button
                    type="button"
                    onClick={clearResearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={!researchUrl.trim() || researchMutation.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium text-sm hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {researchMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang nghiên cứu...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Nghiên Cứu
                  </>
                )}
              </button>
            </form>

            {/* Loading State */}
            {researchMutation.isPending && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-zinc-800/40 border border-zinc-700/50">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                <div>
                  <p className="text-sm text-zinc-300 font-medium">
                    Đang nghiên cứu sản phẩm...
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Trích xuất thông tin từ trang web → Phân tích bằng AI → Tạo chiến lược marketing
                  </p>
                </div>
              </div>
            )}

            {/* Error State */}
            {researchResult && !researchResult.success && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-950/30 border border-red-800/40">
                <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-red-300 font-medium">
                    Nghiên cứu thất bại
                  </p>
                  <p className="text-xs text-red-400/80 mt-0.5">
                    {researchResult.error?.message || "Đã xảy ra lỗi không xác định"}
                  </p>
                </div>
              </div>
            )}

            {/* Success: Research Results */}
            {researchResult?.success && researchResult.product && (
              <ResearchResultPanel
                product={researchResult.product}
                onGenerateVideo={handleGenerateVideo}
                generatingProductId={generatingProductId}
              />
            )}
          </div>
        )}
      </div>

      {/* Product List Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/40">
          <ShoppingBag className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-zinc-300 font-medium">Chưa có sản phẩm nào</h3>
          <p className="text-zinc-500 text-sm mt-1 max-w-md mx-auto">
            Hãy thêm sản phẩm đầu tiên để bắt đầu tạo video quảng cáo bán hàng tự động bằng AI.
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-sm hover:bg-zinc-700 transition"
          >
            <Plus className="w-4 h-4" /> Thêm Sản Phẩm
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 hover:border-zinc-700 transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Product Image Preview */}
                <div className="relative w-full h-40 bg-zinc-950 rounded-lg overflow-hidden mb-4 border border-zinc-800 flex items-center justify-center">
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center text-zinc-600">
                      <ImageIcon className="w-8 h-8 mb-1" />
                      <span className="text-xs">Không có hình ảnh</span>
                    </div>
                  )}
                  {product.price && (
                    <div className="absolute top-2 right-2 bg-zinc-950/90 backdrop-blur-md px-2.5 py-1 rounded-md border border-zinc-800 text-xs font-bold text-emerald-400">
                      {product.price} {product.currency}
                    </div>
                  )}
                  {product.researchStatus === "COMPLETED" && (
                    <div className="absolute top-2 left-2 bg-emerald-950/90 backdrop-blur-md px-2 py-0.5 rounded-md border border-emerald-800/50 text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      AI Research
                    </div>
                  )}
                </div>

                {/* Info */}
                <h3 className="font-semibold text-zinc-100 text-lg line-clamp-1">
                  {product.name}
                </h3>
                {product.category && (
                  <span className="text-[10px] text-violet-400 bg-violet-950/50 border border-violet-800/30 px-2 py-0.5 rounded-full mt-1 inline-block">
                    {product.category}
                  </span>
                )}
                {product.description && (
                  <p className="text-zinc-400 text-xs mt-1 line-clamp-2">
                    {product.description}
                  </p>
                )}

                {/* Features Badges */}
                {product.features && product.features.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {product.features.slice(0, 3).map((feat, i) => (
                      <span
                        key={i}
                        className="bg-zinc-800/80 text-zinc-300 text-[11px] px-2 py-0.5 rounded border border-zinc-700/50"
                      >
                        {feat}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Footer */}
              <div className="mt-5 pt-4 border-t border-zinc-800/60 flex items-center justify-between gap-2">
                <a
                  href={product.affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-violet-400 hover:underline inline-flex items-center gap-1 line-clamp-1 max-w-[140px]"
                >
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  Affiliate Link
                </a>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => deleteMutation.mutate(product.id)}
                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800/60 rounded-lg transition"
                    title="Xóa sản phẩm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleGenerateVideo(product.id)}
                    disabled={generatingProductId === product.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs rounded-lg transition shadow-sm disabled:opacity-50"
                  >
                    {generatingProductId === product.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    Tạo Video 9:16
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Thêm Sản Phẩm */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-violet-400" />
                Thêm Sản Phẩm Affiliate Mới
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Tên sản phẩm <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nồi chiên không dầu Philips HD9252 4.1L"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Giá bán
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 1.890.000"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Đơn vị tiền tệ
                  </label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Link Affiliate (Shopee/TikTok Shop/Lazada){" "}
                  <span className="text-red-400">*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://shope.ee/..."
                  value={affiliateUrl}
                  onChange={(e) => setAffiliateUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Mô tả sản phẩm
                </label>
                <textarea
                  rows={2}
                  placeholder="Mô tả ngắn gọn về sản phẩm..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Tính năng nổi bật (Mỗi tính năng 1 dòng)
                </label>
                <textarea
                  rows={3}
                  placeholder="Công nghệ Rapid Air giảm 90% mỡ thừa&#10;Dung tích 4.1L phù hợp gia đình 3-4 người&#10;Bảng điều khiển cảm ứng 7 chế độ cài sẵn"
                  value={featuresText}
                  onChange={(e) => setFeaturesText(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Lợi ích mang lại (Mỗi lợi ích 1 dòng)
                </label>
                <textarea
                  rows={2}
                  placeholder="Nấu ăn nhanh chóng không lo bắn dầu&#10;Dễ dàng vệ sinh với lòng nồi chống dính"
                  value={benefitsText}
                  onChange={(e) => setBenefitsText(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  URL Hình ảnh sản phẩm (Mỗi URL 1 dòng)
                </label>
                <textarea
                  rows={3}
                  placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                  value={imagesText}
                  onChange={(e) => setImagesText(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 font-mono text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition shadow-lg shadow-violet-500/20 disabled:opacity-50"
                >
                  {createMutation.isPending && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  Lưu Sản Phẩm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Research Result Panel — Displays AI-analyzed product data
// ============================================================================

function ResearchResultPanel({
  product,
  onGenerateVideo,
  generatingProductId,
}: {
  product: Product;
  onGenerateVideo: (id: string) => void;
  generatingProductId: string | null;
}) {
  return (
    <div className="rounded-xl border border-emerald-800/30 bg-emerald-950/10 overflow-hidden">
      {/* Success Header */}
      <div className="flex items-center gap-2 px-5 py-3 bg-emerald-950/30 border-b border-emerald-800/20">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-medium text-emerald-300">
          Nghiên cứu hoàn tất
        </span>
      </div>

      <div className="p-5 space-y-5">
        {/* Product Overview Row */}
        <div className="flex gap-5">
          {/* Product Image */}
          {product.images && product.images.length > 0 && (
            <div className="w-32 h-32 rounded-lg overflow-hidden border border-zinc-800 flex-shrink-0 bg-zinc-950">
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
          )}

          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-zinc-100 line-clamp-2">
              {product.name}
            </h3>
            <div className="flex items-center gap-3 mt-2">
              {product.price && (
                <span className="text-lg font-bold text-emerald-400">
                  {product.price} {product.currency}
                </span>
              )}
              {product.category && (
                <span className="text-xs text-violet-400 bg-violet-950/60 border border-violet-800/30 px-2.5 py-0.5 rounded-full">
                  {product.category}
                </span>
              )}
            </div>
            {product.description && (
              <p className="text-xs text-zinc-400 mt-2 line-clamp-3">
                {product.description}
              </p>
            )}
          </div>
        </div>

        {/* Image Gallery */}
        {product.images && product.images.length > 1 && (
          <div>
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              Hình ảnh sản phẩm ({product.images.length})
            </h4>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {product.images.slice(0, 8).map((img, i) => (
                <div
                  key={i}
                  className="w-20 h-20 rounded-lg overflow-hidden border border-zinc-800 flex-shrink-0 bg-zinc-950"
                >
                  <img
                    src={img}
                    alt={`Product image ${i + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analysis Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Features */}
          {product.features && product.features.length > 0 && (
            <AnalysisCard
              icon={<Zap className="w-4 h-4" />}
              title="Tính năng nổi bật"
              items={product.features}
              color="blue"
            />
          )}

          {/* Benefits */}
          {product.benefits && product.benefits.length > 0 && (
            <AnalysisCard
              icon={<CheckCircle2 className="w-4 h-4" />}
              title="Lợi ích khách hàng"
              items={product.benefits}
              color="emerald"
            />
          )}

          {/* USP */}
          {product.usp && product.usp.length > 0 && (
            <AnalysisCard
              icon={<Target className="w-4 h-4" />}
              title="Điểm bán hàng độc đáo (USP)"
              items={product.usp}
              color="amber"
            />
          )}

          {/* Target Audience */}
          {product.targetAudience && (
            <AnalysisCard
              icon={<Users className="w-4 h-4" />}
              title="Đối tượng mục tiêu"
              items={product.targetAudience.split(", ")}
              color="violet"
            />
          )}

          {/* Pain Points */}
          {product.painPoints && product.painPoints.length > 0 && (
            <AnalysisCard
              icon={<AlertCircle className="w-4 h-4" />}
              title="Vấn đề được giải quyết"
              items={product.painPoints}
              color="rose"
            />
          )}
        </div>

        {/* Marketing Angles */}
        {product.marketingAngles && product.marketingAngles.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Góc tiếp cận Marketing ({product.marketingAngles.length})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {product.marketingAngles.map((angle, i) => (
                <div
                  key={i}
                  className="bg-zinc-900/80 border border-zinc-800/60 rounded-lg p-3.5 space-y-2"
                >
                  <h5 className="text-sm font-semibold text-zinc-200">
                    {angle.title}
                  </h5>
                  {angle.description && (
                    <p className="text-xs text-zinc-400">{angle.description}</p>
                  )}
                  {angle.hook && (
                    <div className="flex items-start gap-2 bg-indigo-950/30 border border-indigo-800/20 rounded-md px-3 py-2">
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-indigo-300 italic">
                        &ldquo;{angle.hook}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-3 border-t border-zinc-800/40">
          <button
            onClick={() => onGenerateVideo(product.id)}
            disabled={generatingProductId === product.id}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium text-sm hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50"
          >
            {generatingProductId === product.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Tạo Video 9:16 từ sản phẩm này
          </button>
          <a
            href={product.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition"
          >
            <ExternalLink className="w-4 h-4" />
            Xem sản phẩm
          </a>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Analysis Card — Reusable component for feature/benefit/USP lists
// ============================================================================

const colorMap: Record<string, { bg: string; border: string; icon: string; badge: string }> = {
  blue: {
    bg: "bg-blue-950/20",
    border: "border-blue-800/30",
    icon: "text-blue-400",
    badge: "bg-blue-950/40 text-blue-300 border-blue-800/30",
  },
  emerald: {
    bg: "bg-emerald-950/20",
    border: "border-emerald-800/30",
    icon: "text-emerald-400",
    badge: "bg-emerald-950/40 text-emerald-300 border-emerald-800/30",
  },
  amber: {
    bg: "bg-amber-950/20",
    border: "border-amber-800/30",
    icon: "text-amber-400",
    badge: "bg-amber-950/40 text-amber-300 border-amber-800/30",
  },
  violet: {
    bg: "bg-violet-950/20",
    border: "border-violet-800/30",
    icon: "text-violet-400",
    badge: "bg-violet-950/40 text-violet-300 border-violet-800/30",
  },
  rose: {
    bg: "bg-rose-950/20",
    border: "border-rose-800/30",
    icon: "text-rose-400",
    badge: "bg-rose-950/40 text-rose-300 border-rose-800/30",
  },
};

function AnalysisCard({
  icon,
  title,
  items,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  color: string;
}) {
  const colors = colorMap[color] || colorMap.blue;
  return (
    <div className={`${colors.bg} ${colors.border} border rounded-lg p-3.5`}>
      <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5 ${colors.icon}`}>
        {icon}
        {title}
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className={`text-[11px] px-2 py-0.5 rounded border ${colors.badge}`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
