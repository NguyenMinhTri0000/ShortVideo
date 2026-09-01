"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import Link from "next/link";
import {
  ShoppingBag,
  Plus,
  Trash2,
  Video,
  ExternalLink,
  Sparkles,
  Loader2,
  Tag,
  Search,
  Globe,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X,
  Star,
  Zap,
  Target,
  FileText,
  Clock,
  Layers,
  Award,
  Eye,
  Edit3,
  Save,
  RotateCw,
  Image as ImageIcon,
  Upload,
  ArrowUp,
  ArrowDown,
  Play,
  Film,
  Link2,
  FileVideo,
} from "lucide-react";

type ProductContentBrief = {
  product: string;
  brand?: string | null;
  targetAudience: string;
  mainPainPoint: string;
  mainBenefit: string;
  sellingPoints: string[];
  marketingAngle: string;
  recommendedHook: string;
  recommendedCTA: string;
};

type Product = {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  description?: string;
  price?: string;
  originalPrice?: string;
  currency: string;
  discountPercent?: number;
  rating?: number;
  reviewCount?: number;
  affiliateUrl: string;
  sourceUrl?: string;
  sourcePlatform?: string;
  features: string[];
  specifications?: Record<string, any>;
  benefits: string[];
  pros?: string[];
  cons?: string[];
  targetAudience?: string;
  useCases?: string[];
  usp?: string[];
  painPoints?: string[];
  images: string[];
  videos?: string[];
  marketingAngles?: MarketingAngle[];
  contentBrief?: ProductContentBrief;
  researchStatus?: string; // pending, processing, completed, failed, partial
  researchError?: string;
  researchedAt?: string;
  createdAt: string;
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
  jobId?: string;
  product?: Product;
  error?: {
    code: string;
    message: string;
  };
};

type ContentIdea = {
  id: string;
  productId: string;
  title: string;
  description: string;
  contentType: string;
  marketingAngle: string;
  targetAudience: string;
  painPoint: string;
  keyMessage: string;
  hook: string;
  recommendedCTA: string;
  priority: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type ScriptScene = {
  sceneNumber: number;
  startTime: number;
  endTime: number;
  duration: number;
  narration: string;
  onScreenText: string;
  visualDirection: string;
  mediaType: string;
};

type VideoScript = {
  id: string;
  productId: string;
  contentIdeaId?: string | null;
  title: string;
  duration: number;
  language: string;
  hook: string;
  scenes: ScriptScene[];
  cta: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

const CONTENT_TYPE_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  product_review: { label: "Review Sản Phẩm", bg: "bg-blue-500/10 border-blue-500/30", text: "text-blue-400" },
  problem_solution: { label: "Vấn Đề & Giải Pháp", bg: "bg-rose-500/10 border-rose-500/30", text: "text-rose-400" },
  comparison: { label: "So Sánh Thực Tế", bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-400" },
  listicle: { label: "Top Mẹo / Danh Sách", bg: "bg-purple-500/10 border-purple-500/30", text: "text-purple-400" },
  educational: { label: "Hướng Dẫn & Mẹo", bg: "bg-sky-500/10 border-sky-500/30", text: "text-sky-400" },
  storytelling: { label: "Câu Chuyện / Bối Cảnh", bg: "bg-pink-500/10 border-pink-500/30", text: "text-pink-400" },
  testimonial: { label: "Góc Nhìn Khách Hàng", bg: "bg-teal-500/10 border-teal-500/30", text: "text-teal-400" },
  myth_busting: { label: "Giải Mã Hiểu Lầm", bg: "bg-orange-500/10 border-orange-500/30", text: "text-orange-400" },
  use_case: { label: "Kịch Bản Sử Dụng", bg: "bg-indigo-500/10 border-indigo-500/30", text: "text-indigo-400" },
  value_for_money: { label: "Phân Tích Đáng Tiền", bg: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-400" },
  pros_cons: { label: "Ưu & Nhược Điểm", bg: "bg-cyan-500/10 border-cyan-500/30", text: "text-cyan-400" },
  FAQ: { label: "Giải Đáp Thắc Mắc", bg: "bg-violet-500/10 border-violet-500/30", text: "text-violet-400" },
};

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [generatingProductId, setGeneratingProductId] = useState<string | null>(null);

  // Research state
  const [researchUrl, setResearchUrl] = useState("");
  const [researchResult, setResearchResult] = useState<ResearchResult | null>(null);
  const [isResearchPanelExpanded, setIsResearchPanelExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<"specs" | "ai" | "brief">("ai");
  const [modalTab, setModalTab] = useState<"view" | "ideas" | "edit">("view");

  // Content Strategy State
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [selectedIdeaForVideoId, setSelectedIdeaForVideoId] = useState<string | null>(null);

  // Script Engine 2.0 State
  const [generatingScriptIdeaId, setGeneratingScriptIdeaId] = useState<string | null>(null);
  const [activeScriptModal, setActiveScriptModal] = useState<VideoScript | null>(null);
  const [generatingVideoScriptId, setGeneratingVideoScriptId] = useState<string | null>(null);
  const [previewMediaUrl, setPreviewMediaUrl] = useState<{ url: string; type: "image" | "video" } | null>(null);

  // Visual Assets State & Handlers
  const [activeAssetSubTab, setActiveAssetSubTab] = useState<"images" | "videos">("images");
  const [newImageUrlInput, setNewImageUrlInput] = useState("");
  const [newVideoUrlInput, setNewVideoUrlInput] = useState("");
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const [isDiscoveringAssets, setIsDiscoveringAssets] = useState(false);

  const handleUploadAssetFile = async (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "video") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAsset(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/products/assets/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = res.data.url;
      if (type === "image") {
        setEditForm((prev) => ({ ...prev, images: [...(prev.images || []), url] }));
      } else {
        setEditForm((prev) => ({ ...prev, videos: [...(prev.videos || []), url] }));
      }
    } catch (err: any) {
      console.error("Failed to upload asset file:", err);
      alert("Lỗi tải file: " + (err.response?.data?.message || err.message));
    } finally {
      setIsUploadingAsset(false);
      e.target.value = "";
    }
  };

  const handleDiscoverAssets = async () => {
    if (!selectedProduct) return;
    try {
      setIsDiscoveringAssets(true);
      const res = await api.post(`/products/${selectedProduct.id}/discover-assets`);
      if (res.data?.success) {
        alert(res.data.message || `Đã tìm thấy ${res.data.importedCount} ảnh sản phẩm mới!`);
        queryClient.invalidateQueries({ queryKey: ["products"] });
        if (res.data.newImages && res.data.newImages.length > 0) {
          setEditForm((prev) => ({
            ...prev,
            images: [...(prev.images || []), ...res.data.newImages],
          }));
        }
      } else {
        alert("Thông báo: " + (res.data?.message || "Không tìm thấy ảnh mới phù hợp."));
      }
    } catch (err: any) {
      alert("Lỗi tìm kiếm ảnh sản phẩm: " + (err.response?.data?.message || err.message));
    } finally {
      setIsDiscoveringAssets(false);
    }
  };

  const handleAddImageUrl = () => {
    if (!newImageUrlInput.trim()) return;
    setEditForm((prev) => ({ ...prev, images: [...(prev.images || []), newImageUrlInput.trim()] }));
    setNewImageUrlInput("");
  };

  const handleRemoveImage = (index: number) => {
    setEditForm((prev) => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== index),
    }));
  };

  const handleMoveImage = (index: number, direction: "up" | "down") => {
    if (!editForm.images) return;
    const newImages = [...editForm.images];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newImages.length) return;
    const temp = newImages[index];
    newImages[index] = newImages[targetIndex];
    newImages[targetIndex] = temp;
    setEditForm((prev) => ({ ...prev, images: newImages }));
  };

  const handleAddVideoUrl = () => {
    if (!newVideoUrlInput.trim()) return;
    setEditForm((prev) => ({ ...prev, videos: [...(prev.videos || []), newVideoUrlInput.trim()] }));
    setNewVideoUrlInput("");
  };

  const handleRemoveVideo = (index: number) => {
    setEditForm((prev) => ({
      ...prev,
      videos: (prev.videos || []).filter((_, i) => i !== index),
    }));
  };

  const { data: contentIdeas = [], isLoading: isLoadingIdeas, refetch: refetchIdeas } = useQuery<ContentIdea[]>({
    queryKey: ["content-ideas", selectedProduct?.id],
    queryFn: () =>
      selectedProduct
        ? api.get(`/products/${selectedProduct.id}/content-ideas`).then((res) => res.data)
        : Promise.resolve([]),
    enabled: !!selectedProduct,
  });

  const handleGenerateContentIdeas = async (productId: string) => {
    try {
      setIsGeneratingIdeas(true);
      await api.post(`/products/${productId}/content-ideas/generate`);
      await refetchIdeas();
    } catch (err: any) {
      alert("Lỗi tạo ý tưởng nội dung: " + (err.response?.data?.message || err.message));
    } finally {
      setIsGeneratingIdeas(false);
    }
  };

  const handleGenerateVideoFromIdea = async (ideaId: string) => {
    try {
      setSelectedIdeaForVideoId(ideaId);
      await api.post(`/content-ideas/${ideaId}/generate-video`);
      alert("Đã tạo Job video từ ý tưởng này thành công! Video đang được tạo trong hàng đợi.");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["content-ideas", selectedProduct?.id] });
    } catch (err: any) {
      alert("Lỗi tạo video từ ý tưởng: " + (err.response?.data?.message || err.message));
    } finally {
      setSelectedIdeaForVideoId(null);
    }
  };

  const handleGenerateScript = async (ideaId: string) => {
    try {
      setGeneratingScriptIdeaId(ideaId);
      const res = await api.post(`/content-ideas/${ideaId}/generate-script`);
      setActiveScriptModal(res.data);
      queryClient.invalidateQueries({ queryKey: ["content-ideas", selectedProduct?.id] });
    } catch (err: any) {
      alert("Lỗi tạo kịch bản 2.0: " + (err.response?.data?.message || err.message));
    } finally {
      setGeneratingScriptIdeaId(null);
    }
  };

  const handleViewScript = async (ideaId: string) => {
    try {
      setGeneratingScriptIdeaId(ideaId);
      const res = await api.get(`/content-ideas/${ideaId}/scripts`);
      if (res.data && res.data.length > 0) {
        setActiveScriptModal(res.data[0]);
      } else {
        await handleGenerateScript(ideaId);
      }
    } catch (err: any) {
      alert("Lỗi tải kịch bản: " + (err.response?.data?.message || err.message));
    } finally {
      setGeneratingScriptIdeaId(null);
    }
  };

  const handleGenerateVideoFromScript = async (scriptId: string) => {
    try {
      setGeneratingVideoScriptId(scriptId);
      await api.post(`/scripts/${scriptId}/generate-video`);
      alert("Đã gửi kịch bản 2.0 sang Video Generation Engine thành công!");
      setActiveScriptModal(null);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["content-ideas", selectedProduct?.id] });
    } catch (err: any) {
      alert("Lỗi tạo video từ kịch bản: " + (err.response?.data?.message || err.message));
    } finally {
      setGeneratingVideoScriptId(null);
    }
  };

  // Manual Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("VND");
  const [affiliateUrl, setAffiliateUrl] = useState("");
  const [featuresText, setFeaturesText] = useState("");
  const [benefitsText, setBenefitsText] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [imagesText, setImagesText] = useState("");

  // Edit Modal Form State
  const [editForm, setEditForm] = useState<Partial<Product>>({});

  const { data: products = [] } = useQuery<Product[]>({
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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/products/${id}`, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      if (res.data) {
        setSelectedProduct(res.data);
      }
      setModalTab("view");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      if (selectedProduct) setSelectedProduct(null);
    },
  });

  const researchMutation = useMutation({
    mutationFn: (url: string) =>
      api.post("/products/research", { url }).then((res) => res.data as ResearchResult),
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
          message:
            error?.response?.data?.message || error?.message || "Lỗi kết nối. Vui lòng thử lại.",
        },
      });
    },
  });

  // Poll active research status if in pending/processing state
  useEffect(() => {
    if (!researchResult?.product?.id) return;
    const status = researchResult.product.researchStatus;
    if (status === "pending" || status === "processing" || status === "RESEARCHING") {
      const interval = setInterval(async () => {
        try {
          const res = await api.get(`/products/${researchResult.product!.id}/research`);
          if (res.data?.product) {
            setResearchResult(res.data);
            if (
              res.data.product.researchStatus === "completed" ||
              res.data.product.researchStatus === "partial" ||
              res.data.product.researchStatus === "failed"
            ) {
              queryClient.invalidateQueries({ queryKey: ["products"] });
              clearInterval(interval);
            }
          }
        } catch (e) {
          console.error("Polling status failed", e);
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [researchResult?.product?.id, researchResult?.product?.researchStatus, queryClient]);

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

  const handleOpenDetailModal = (product: Product) => {
    setSelectedProduct(product);
    setEditForm({
      name: product.name,
      brand: product.brand || "",
      category: product.category || "",
      price: product.price || "",
      description: product.description || "",
      targetAudience: product.targetAudience || "",
      features: product.features || [],
      benefits: product.benefits || [],
      usp: product.usp || [],
      painPoints: product.painPoints || [],
      images: product.images || [],
      videos: product.videos || [],
    });
    setModalTab("view");
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    updateMutation.mutate({
      id: selectedProduct.id,
      data: editForm,
    });
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
        subtitle_enabled: true,
        font_name: "BeVietnamPro-Bold.ttf",
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

  const getDisplayName = (product: Product) => {
    const isPlaceholder = !product.name || product.name.startsWith("Đang nghiên cứu");
    if (
      isPlaceholder &&
      (product.researchStatus === "completed" ||
        product.researchStatus === "COMPLETED" ||
        product.researchStatus === "partial" ||
        product.researchStatus === "PARTIAL")
    ) {
      if (product.contentBrief?.product && product.contentBrief.product !== "Sản phẩm") {
        return product.contentBrief.product;
      }
      if (product.brand) return `Sản phẩm ${product.brand}`;
      if (product.category) return `Sản phẩm ${product.category}`;
      if (product.sourcePlatform) return `Sản phẩm (${product.sourcePlatform})`;
      return "Sản phẩm Chi Tiết";
    }
    return product.name;
  };

  const renderStatusBadge = (status?: string) => {
    const s = (status || "").toLowerCase();
    switch (s) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> Nghiên cứu hoàn tất
          </span>
        );
      case "partial":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-medium">
            <AlertCircle className="w-3.5 h-3.5" /> Một phần
          </span>
        );
      case "processing":
      case "researching":
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang phân tích...
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/30 text-xs font-medium">
            <AlertCircle className="w-3.5 h-3.5" /> Thất bại
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-violet-400" />
            Sản Phẩm Affiliate & Research Engine
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Nghiên cứu tự động thông tin sản phẩm từ URL và tạo AI Content Brief phục vụ sản xuất Video Short
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium text-sm hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-violet-500/20"
        >
          <Plus className="w-4 h-4" />
          Thêm Thủ Công
        </button>
      </div>

      {/* ============================================================== */}
      {/* PRODUCT RESEARCH ENGINE PANEL */}
      {/* ============================================================== */}
      <div className="bg-gradient-to-br from-zinc-900/90 via-zinc-900/70 to-indigo-950/40 border border-zinc-800/80 rounded-xl overflow-hidden shadow-2xl">
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
              <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                Product Research Engine
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  AI Layered Extraction
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Nhập Product URL → Tự động thu thập JSON-LD, specs, đánh giá & tạo AI Marketing Strategy
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
                  placeholder="https://shopee.vn/product/... hoặc URL sản phẩm bất kỳ"
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
                    Nghiên Cứu Sản Phẩm
                  </>
                )}
              </button>
            </form>

            {/* Error Message */}
            {researchResult && !researchResult.success && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-rose-200">Nghiên cứu thất bại</p>
                  <p className="text-xs text-rose-300/80 mt-1">
                    {researchResult.error?.message || "Không thể tải trang sản phẩm."}
                  </p>
                </div>
              </div>
            )}

            {/* Research Result Detailed Breakdown */}
            {researchResult?.success && researchResult.product && (
              <div className="space-y-6 pt-2">
                {/* Product Overview Card */}
                <div className="flex flex-col md:flex-row gap-6 p-5 rounded-xl bg-zinc-950/80 border border-zinc-800">
                  {/* Image */}
                  <div className="w-full md:w-48 h-48 rounded-lg overflow-hidden bg-zinc-900 shrink-0 relative">
                    {researchResult.product.images?.[0] ? (
                      <img
                        src={researchResult.product.images[0]}
                        alt={researchResult.product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600">
                        <ShoppingBag className="w-12 h-12" />
                      </div>
                    )}
                    {researchResult.product.sourcePlatform && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] text-zinc-300 uppercase tracking-wider font-semibold border border-zinc-700">
                        {researchResult.product.sourcePlatform}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {renderStatusBadge(researchResult.product.researchStatus)}
                          {researchResult.product.brand && (
                            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                              {researchResult.product.brand}
                            </span>
                          )}
                          {researchResult.product.category && (
                            <span className="text-xs text-zinc-400">
                              • {researchResult.product.category}
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-zinc-100 mt-1 line-clamp-2">
                          {getDisplayName(researchResult.product)}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleOpenDetailModal(researchResult.product!)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-all whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5" /> Xem / Sửa Chi Tiết
                        </button>
                        <button
                          onClick={() => handleGenerateVideo(researchResult.product!.id)}
                          disabled={generatingProductId === researchResult.product.id}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg shadow-violet-600/20 transition-all whitespace-nowrap"
                        >
                          {generatingProductId === researchResult.product.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Video className="w-4 h-4" />
                          )}
                          Tạo Video 9:16 Ngay
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      {researchResult.product.price && (
                        <span className="text-emerald-400 font-bold text-lg">
                          {researchResult.product.price} {researchResult.product.currency}
                        </span>
                      )}
                      {researchResult.product.originalPrice && (
                        <span className="text-zinc-500 line-through text-xs">
                          {researchResult.product.originalPrice}
                        </span>
                      )}
                      {researchResult.product.discountPercent != null && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold">
                          -{researchResult.product.discountPercent}%
                        </span>
                      )}
                      {researchResult.product.rating != null && (
                        <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          <Star className="w-3 h-3 fill-amber-400" />
                          {researchResult.product.rating} ({researchResult.product.reviewCount || 0} reviews)
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-zinc-400 line-clamp-2">
                      {researchResult.product.description}
                    </p>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-zinc-800">
                  <button
                    onClick={() => setActiveTab("ai")}
                    className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
                      activeTab === "ai"
                        ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                        : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    AI Marketing Insights
                  </button>
                  <button
                    onClick={() => setActiveTab("brief")}
                    className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
                      activeTab === "brief"
                        ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                        : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Product Content Brief
                  </button>
                  <button
                    onClick={() => setActiveTab("specs")}
                    className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
                      activeTab === "specs"
                        ? "border-violet-500 text-violet-400 bg-violet-500/5"
                        : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    Thông Số & Dữ Liệu Gốc
                  </button>
                </div>

                {/* Tab Content: AI Marketing Insights */}
                {activeTab === "ai" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* USP & Selling Points */}
                    <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800/80 space-y-2">
                      <h4 className="text-xs font-bold text-amber-400 flex items-center gap-2 uppercase tracking-wider">
                        <Award className="w-4 h-4" /> Key Selling Points (USP)
                      </h4>
                      <ul className="space-y-1.5">
                        {(researchResult.product.usp || researchResult.product.features || []).map(
                          (item, idx) => (
                            <li key={idx} className="text-xs text-zinc-300 flex items-start gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </li>
                          ),
                        )}
                      </ul>
                    </div>

                    {/* Target Audience & Pain Points */}
                    <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800/80 space-y-2">
                      <h4 className="text-xs font-bold text-sky-400 flex items-center gap-2 uppercase tracking-wider">
                        <Target className="w-4 h-4" /> Khách Hàng Mục Tiêu & Pain Points
                      </h4>
                      <p className="text-xs text-zinc-300 font-medium">
                        Audience: {researchResult.product.targetAudience || "Chưa xác định"}
                      </p>
                      <div className="space-y-1 pt-1">
                        <p className="text-[11px] text-zinc-500 uppercase font-semibold">
                          Pain Points giải quyết:
                        </p>
                        {(researchResult.product.painPoints || []).map((point, idx) => (
                          <span
                            key={idx}
                            className="inline-block mr-1.5 mb-1.5 px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 text-xs"
                          >
                            {point}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Marketing Angles */}
                    <div className="md:col-span-2 p-4 rounded-lg bg-zinc-950/60 border border-zinc-800/80 space-y-3">
                      <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-2 uppercase tracking-wider">
                        <Zap className="w-4 h-4" /> Đề Xuất Marketing Angles & Hooks cho Video
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(researchResult.product.marketingAngles || []).map((angle, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded bg-zinc-900/80 border border-zinc-800 space-y-1.5"
                          >
                            <span className="text-xs font-bold text-emerald-300">
                              #{idx + 1} {angle.title}
                            </span>
                            <p className="text-xs text-zinc-400">{angle.description}</p>
                            <div className="p-2 rounded bg-emerald-950/30 border border-emerald-500/20 text-xs text-emerald-200 italic">
                              &quot;{angle.hook}&quot;
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab Content: Product Content Brief */}
                {activeTab === "brief" && (
                  <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-950/30 to-zinc-950 border border-indigo-500/30 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-400" />
                        AI Reusable Content Brief
                      </h4>
                      <span className="text-[11px] text-indigo-400/80 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                        Input for Content Strategy Engine
                      </span>
                    </div>

                    {researchResult.product.contentBrief ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="p-3 rounded bg-zinc-900/60 border border-zinc-800 space-y-1">
                          <span className="text-zinc-500 font-semibold uppercase text-[10px]">
                            Target Audience
                          </span>
                          <p className="text-zinc-200">
                            {researchResult.product.contentBrief.targetAudience}
                          </p>
                        </div>

                        <div className="p-3 rounded bg-zinc-900/60 border border-zinc-800 space-y-1">
                          <span className="text-zinc-500 font-semibold uppercase text-[10px]">
                            Main Benefit
                          </span>
                          <p className="text-emerald-300">
                            {researchResult.product.contentBrief.mainBenefit}
                          </p>
                        </div>

                        <div className="p-3 rounded bg-zinc-900/60 border border-zinc-800 space-y-1">
                          <span className="text-zinc-500 font-semibold uppercase text-[10px]">
                            Recommended Hook
                          </span>
                          <p className="text-amber-300 font-medium">
                            &quot;{researchResult.product.contentBrief.recommendedHook}&quot;
                          </p>
                        </div>

                        <div className="p-3 rounded bg-zinc-900/60 border border-zinc-800 space-y-1">
                          <span className="text-zinc-500 font-semibold uppercase text-[10px]">
                            Recommended Call To Action (CTA)
                          </span>
                          <p className="text-sky-300 font-medium">
                            {researchResult.product.contentBrief.recommendedCTA}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500">Đang khởi tạo Content Brief...</p>
                    )}
                  </div>
                )}

                {/* Tab Content: Specs */}
                {activeTab === "specs" && (
                  <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-3">
                    <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                      Thông Số Kỹ Thuật Chi Tiết
                    </h4>
                    {researchResult.product.specifications &&
                    Object.keys(researchResult.product.specifications).length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {Object.entries(researchResult.product.specifications).map(
                          ([k, v], idx) => (
                            <div
                              key={idx}
                              className="flex justify-between p-2 rounded bg-zinc-900/80 border border-zinc-800/60"
                            >
                              <span className="text-zinc-400 font-medium">{k}</span>
                              <span className="text-zinc-200 text-right">{String(v)}</span>
                            </div>
                          ),
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500">Không có thông số bảng.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* EXISTING PRODUCT LIST SECTION */}
      {/* ============================================================== */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
          Danh Sách Sản Phẩm Đã Lưu
          <span className="text-xs font-normal text-zinc-500">({products.length})</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl overflow-hidden hover:border-zinc-700 transition-all flex flex-col justify-between"
            >
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 cursor-pointer" onClick={() => handleOpenDetailModal(product)}>
                    <div className="flex items-center gap-2">
                      {renderStatusBadge(product.researchStatus)}
                      {product.brand && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                          {product.brand}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-zinc-100 text-sm line-clamp-1 hover:text-emerald-400 transition-colors">
                      {getDisplayName(product)}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenDetailModal(product)}
                      className="text-zinc-500 hover:text-zinc-200 p-1 transition-colors"
                      title="Xem & Chỉnh sửa chi tiết"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(product.id)}
                      className="text-zinc-500 hover:text-rose-400 p-1 transition-colors"
                      title="Xóa sản phẩm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {product.images?.[0] && (
                  <div
                    className="h-36 rounded-lg bg-zinc-950 overflow-hidden cursor-pointer"
                    onClick={() => handleOpenDetailModal(product)}
                  >
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between text-xs">
                  {product.price ? (
                    <span className="text-emerald-400 font-bold">
                      {product.price} {product.currency}
                    </span>
                  ) : (
                    <span className="text-zinc-500">Chưa có giá</span>
                  )}
                  {product.affiliateUrl && (
                    <a
                      href={product.affiliateUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-violet-400 hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <ExternalLink className="w-3 h-3" /> Link
                    </a>
                  )}
                </div>
              </div>

              <div className="px-5 py-3 bg-zinc-950/60 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleOpenDetailModal(product)}
                  className="text-xs text-zinc-400 hover:text-zinc-200 font-medium flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" /> Chi Tiết / Sửa
                </button>

                <button
                  onClick={() => handleGenerateVideo(product.id)}
                  disabled={generatingProductId === product.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-all shadow-md shadow-violet-600/20"
                >
                  {generatingProductId === product.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Video className="w-3.5 h-3.5" />
                  )}
                  Tạo Video 9:16
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ============================================================== */}
      {/* PRODUCT RESEARCH INSPECT & EDIT MODAL */}
      {/* ============================================================== */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/80">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-100 text-base">
                    {getDisplayName(selectedProduct)}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Chi tiết kết quả nghiên cứu sản phẩm & AI Content Brief
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-zinc-800 px-6 bg-zinc-950/40">
              <button
                onClick={() => setModalTab("view")}
                className={`px-4 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
                  modalTab === "view"
                    ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Eye className="w-4 h-4" />
                Xem Kết Quả Phân Tích AI
              </button>
              <button
                onClick={() => setModalTab("ideas")}
                className={`px-4 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
                  modalTab === "ideas"
                    ? "border-amber-500 text-amber-400 bg-amber-500/5"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Zap className="w-4 h-4 text-amber-400" />
                Ý Tưởng Nội Dung AI ({contentIdeas.length})
              </button>
              <button
                onClick={() => setModalTab("edit")}
                className={`px-4 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
                  modalTab === "edit"
                    ? "border-violet-500 text-violet-400 bg-violet-500/5"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Edit3 className="w-4 h-4" />
                Chỉnh Sửa Dữ Liệu
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {modalTab === "view" ? (
                <div className="space-y-6">
                  {/* General Info Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 uppercase font-semibold">Tên sản phẩm</span>
                      <p className="text-xs text-zinc-200 font-medium mt-1">{getDisplayName(selectedProduct)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 uppercase font-semibold">Thương hiệu / Danh mục</span>
                      <p className="text-xs text-zinc-200 font-medium mt-1">
                        {selectedProduct.brand || "—"} / {selectedProduct.category || "—"}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 uppercase font-semibold">Giá bán</span>
                      <p className="text-xs text-emerald-400 font-bold mt-1">
                        {selectedProduct.price ? `${selectedProduct.price} ${selectedProduct.currency}` : "Chưa cập nhật"}
                      </p>
                    </div>
                  </div>

                  {/* AI Content Brief Section */}
                  {selectedProduct.contentBrief && (
                    <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30 space-y-3">
                      <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-2 uppercase tracking-wider">
                        <FileText className="w-4 h-4 text-indigo-400" /> Content Brief Cho AI Script
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800">
                          <span className="text-zinc-500 text-[10px] block">Khách hàng mục tiêu</span>
                          <span className="text-zinc-200">{selectedProduct.contentBrief.targetAudience}</span>
                        </div>
                        <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800">
                          <span className="text-zinc-500 text-[10px] block">Lợi ích chính</span>
                          <span className="text-emerald-300">{selectedProduct.contentBrief.mainBenefit}</span>
                        </div>
                        <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800">
                          <span className="text-zinc-500 text-[10px] block">Hook Đề Xuất</span>
                          <span className="text-amber-300 italic">&quot;{selectedProduct.contentBrief.recommendedHook}&quot;</span>
                        </div>
                        <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800">
                          <span className="text-zinc-500 text-[10px] block">Call To Action (CTA)</span>
                          <span className="text-sky-300">{selectedProduct.contentBrief.recommendedCTA}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pain Points & USP */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
                      <h4 className="text-xs font-bold text-amber-400 uppercase">Key Selling Points (USP)</h4>
                      <ul className="space-y-1">
                        {(selectedProduct.usp || selectedProduct.features || []).map((u, i) => (
                          <li key={i} className="text-xs text-zinc-300 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> {u}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
                      <h4 className="text-xs font-bold text-rose-400 uppercase">Pain Points</h4>
                      <ul className="space-y-1">
                        {(selectedProduct.painPoints || []).map((p, i) => (
                          <li key={i} className="text-xs text-rose-200 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" /> {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Product Visual Assets Overview in View Tab */}
                  {((selectedProduct.images && selectedProduct.images.length > 0) ||
                    (selectedProduct.videos && selectedProduct.videos.length > 0)) && (
                    <div className="p-4 rounded-xl bg-violet-950/20 border border-violet-500/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-violet-300 flex items-center gap-2 uppercase tracking-wider">
                          <ImageIcon className="w-4 h-4 text-violet-400" /> Product Visual Assets ({selectedProduct.images?.length || 0} Ảnh, {selectedProduct.videos?.length || 0} Video)
                        </h4>
                        <button
                          type="button"
                          onClick={() => setModalTab("edit")}
                          className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 font-semibold"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Quản lý Assets
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {(selectedProduct.images || []).map((img, i) => (
                          <div
                            key={i}
                            onClick={() => setPreviewMediaUrl({ url: img, type: "image" })}
                            className="relative group rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800 aspect-square cursor-pointer"
                          >
                            <img src={img} alt={`Asset image ${i}`} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Eye className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        ))}
                        {(selectedProduct.videos || []).map((vid, i) => (
                          <div
                            key={i}
                            onClick={() => setPreviewMediaUrl({ url: vid, type: "video" })}
                            className="relative group rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800 aspect-square cursor-pointer flex flex-col items-center justify-center bg-black/80"
                          >
                            <Film className="w-6 h-6 text-indigo-400" />
                            <span className="text-[10px] text-zinc-300 font-semibold mt-1">Video #{i + 1}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Re-Research Action */}
                  <div className="p-4 rounded-lg bg-zinc-950/80 border border-zinc-800 flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-semibold text-zinc-200">Chạy lại AI Research</h5>
                      <p className="text-[11px] text-zinc-500">
                        Nghiên cứu lại từ URL sản phẩm ({selectedProduct.affiliateUrl})
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setResearchUrl(selectedProduct.affiliateUrl);
                        setSelectedProduct(null);
                        handleResearch({ preventDefault: () => {} } as any);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all"
                    >
                      <RotateCw className="w-3.5 h-3.5" /> Chạy Lại Research
                    </button>
                  </div>
                </div>
              ) : modalTab === "ideas" ? (
                <div className="space-y-6">
                  {/* Action Header */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-violet-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400" /> Chiến Lược Nội Dung & Ý Tưởng Video (Content Strategy)
                      </h4>
                      <p className="text-xs text-zinc-400 mt-1">
                        Tự động phân tích từ dữ liệu nghiên cứu sản phẩm để đề xuất 10-20 góc khai thác video độc đáo trước khi tạo kịch bản.
                      </p>
                    </div>
                    <button
                      onClick={() => handleGenerateContentIdeas(selectedProduct.id)}
                      disabled={isGeneratingIdeas}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/20 shrink-0 transition-all"
                    >
                      {isGeneratingIdeas ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Zap className="w-4 h-4" />
                      )}
                      {contentIdeas.length > 0 ? "Tạo Lại 10-20 Ý Tưởng Mới" : "Tạo Ý Tưởng Nội Dung (AI)"}
                    </button>
                  </div>

                  {/* Ideas List */}
                  {isLoadingIdeas || isGeneratingIdeas ? (
                    <div className="p-12 text-center space-y-3 bg-zinc-950/40 rounded-xl border border-zinc-800">
                      <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
                      <p className="text-xs text-zinc-300 font-medium">Đang dùng AI tạo 10-20 góc nội dung độc đáo cho sản phẩm...</p>
                      <p className="text-[11px] text-zinc-500">Đang phân tích tính năng, nỗi đau người dùng, ưu nhược điểm và lập định dạng video</p>
                    </div>
                  ) : contentIdeas.length === 0 ? (
                    <div className="p-10 text-center space-y-3 bg-zinc-950/40 rounded-xl border border-zinc-800">
                      <Target className="w-10 h-10 text-zinc-600 mx-auto" />
                      <h5 className="text-sm font-bold text-zinc-300">Chưa có Ý tưởng Nội dung nào</h5>
                      <p className="text-xs text-zinc-400 max-w-md mx-auto">
                        Bấm nút &quot;Tạo Ý Tưởng Nội Dung (AI)&quot; ở trên để AI tạo tự động từ 10 đến 20 góc tiếp thị khác nhau.
                      </p>
                      <button
                        onClick={() => handleGenerateContentIdeas(selectedProduct.id)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all mt-2"
                      >
                        <Zap className="w-4 h-4" /> Bắt Đầu Tạo Ý Tưởng AI
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs text-zinc-400 font-medium px-1">
                        <span>Danh sách {contentIdeas.length} ý tưởng nội dung độc đáo:</span>
                        <span className="text-emerald-400 font-semibold">Chọn ý tưởng → Bấm &quot;Tạo Video&quot;</span>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        {contentIdeas.map((idea, index) => {
                          const badge = CONTENT_TYPE_BADGES[idea.contentType] || {
                            label: idea.contentType,
                            bg: "bg-zinc-800 border-zinc-700",
                            text: "text-zinc-300",
                          };

                          return (
                            <div
                              key={idea.id}
                              className="p-5 rounded-xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 transition-all space-y-4 shadow-lg group relative overflow-hidden"
                            >
                              {/* Top Bar */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                      #{index + 1}
                                    </span>
                                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${badge.bg} ${badge.text}`}>
                                      {badge.label}
                                    </span>
                                    <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                                      Góc: {idea.marketingAngle}
                                    </span>
                                    {idea.priority === 1 && (
                                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1">
                                        <Award className="w-3 h-3" /> Đề xuất cao
                                      </span>
                                    )}
                                  </div>

                                  <h4 className="text-base font-bold text-zinc-100 group-hover:text-amber-300 transition-colors pt-1">
                                    {idea.title}
                                  </h4>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    onClick={() => handleViewScript(idea.id)}
                                    disabled={generatingScriptIdeaId === idea.id}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/20 transition-all"
                                  >
                                    {generatingScriptIdeaId === idea.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Sparkles className="w-4 h-4 text-amber-200" />
                                    )}
                                    Tạo Kịch Bản 2.0
                                  </button>

                                  <button
                                    onClick={() => handleGenerateVideoFromIdea(idea.id)}
                                    disabled={selectedIdeaForVideoId === idea.id}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-lg shadow-violet-600/20 transition-all"
                                  >
                                    {selectedIdeaForVideoId === idea.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Video className="w-4 h-4" />
                                    )}
                                    Tạo Video
                                  </button>
                                </div>
                              </div>

                              <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/60 p-3 rounded-lg border border-zinc-800/60">
                                {idea.description}
                              </p>

                              {/* Strategy Breakdown */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
                                  <span className="text-zinc-500 text-[10px] uppercase font-semibold block">Đối tượng khán giả</span>
                                  <span className="text-zinc-200 font-medium">{idea.targetAudience}</span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
                                  <span className="text-zinc-500 text-[10px] uppercase font-semibold block">Nỗi đau / Vấn đề</span>
                                  <span className="text-rose-300 font-medium">{idea.painPoint}</span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
                                  <span className="text-zinc-500 text-[10px] uppercase font-semibold block">Hook mở đầu 3s</span>
                                  <span className="text-amber-300 italic font-medium">&quot;{idea.hook}&quot;</span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
                                  <span className="text-zinc-500 text-[10px] uppercase font-semibold block">CTA Kêu gọi</span>
                                  <span className="text-sky-300 font-medium">{idea.recommendedCTA}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Edit Form Tab */
                <form onSubmit={handleSaveEdit} className="space-y-6">
                  {/* Metadata Section */}
                  <div className="space-y-4 p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                    <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-4 h-4 text-violet-400" /> Thông Tin Cơ Bản
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Tên Sản Phẩm</label>
                        <input
                          type="text"
                          value={editForm.name || ""}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-violet-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Thương Hiệu (Brand)</label>
                        <input
                          type="text"
                          value={editForm.brand || ""}
                          onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-violet-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Danh Mục (Category)</label>
                        <input
                          type="text"
                          value={editForm.category || ""}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-violet-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Giá Bán</label>
                        <input
                          type="text"
                          value={editForm.price || ""}
                          onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-violet-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">Mô Tả Sản Phẩm</label>
                      <textarea
                        rows={3}
                        value={editForm.description || ""}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-violet-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">Khách Hàng Mục Tiêu</label>
                      <input
                        type="text"
                        value={editForm.targetAudience || ""}
                        onChange={(e) => setEditForm({ ...editForm, targetAudience: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>

                  {/* Product Visual Assets Section */}
                  <div className="space-y-4 p-4 rounded-xl bg-violet-950/10 border border-violet-500/20">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-violet-400" />
                        <h4 className="text-xs font-bold text-violet-300 uppercase tracking-wider">
                          Product Visual Assets (Hình ảnh & Video Sản Phẩm)
                        </h4>
                        <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-semibold">
                          {(editForm.images?.length || 0) + (editForm.videos?.length || 0)} Assets
                        </span>
                      </div>

                      {/* Visual Sub-tabs */}
                      <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                        <button
                          type="button"
                          onClick={() => setActiveAssetSubTab("images")}
                          className={`px-3 py-1 text-[11px] font-medium rounded-md flex items-center gap-1.5 transition-all ${
                            activeAssetSubTab === "images"
                              ? "bg-violet-600 text-white shadow-sm"
                              : "text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          Hình Ảnh ({editForm.images?.length || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveAssetSubTab("videos")}
                          className={`px-3 py-1 text-[11px] font-medium rounded-md flex items-center gap-1.5 transition-all ${
                            activeAssetSubTab === "videos"
                              ? "bg-violet-600 text-white shadow-sm"
                              : "text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          <Film className="w-3.5 h-3.5" />
                          Video Clips ({editForm.videos?.length || 0})
                        </button>
                      </div>
                    </div>

                    {/* IMAGES SUB-TAB */}
                    {activeAssetSubTab === "images" && (
                      <div className="space-y-4">
                        {/* Image Upload & URL input bar */}
                        <div className="flex flex-col sm:flex-row gap-2">
                          <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-3 py-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/40 rounded-lg text-xs font-semibold shrink-0 transition-colors">
                            {isUploadingAsset ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Upload className="w-3.5 h-3.5" />
                            )}
                            Tải Ảnh Từ Máy Tính
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={isUploadingAsset}
                              onChange={(e) => handleUploadAssetFile(e, "image")}
                            />
                          </label>

                          <button
                            type="button"
                            onClick={handleDiscoverAssets}
                            disabled={isDiscoveringAssets}
                            className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold shrink-0 transition-all shadow-sm"
                          >
                            {isDiscoveringAssets ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            )}
                            Tự Động Tìm Thêm Ảnh (AI Discovery)
                          </button>
                          <div className="flex-1 flex gap-2">
                            <div className="relative flex-1">
                              <Link2 className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                placeholder="Dán đường dẫn (URL) hình ảnh sản phẩm..."
                                value={newImageUrlInput}
                                onChange={(e) => setNewImageUrlInput(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleAddImageUrl}
                              className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium shrink-0"
                            >
                              Thêm URL
                            </button>
                          </div>
                        </div>

                        {/* Image Thumbnails Grid */}
                        {editForm.images && editForm.images.length > 0 ? (
                          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-64 overflow-y-auto pr-1">
                            {editForm.images.map((imgUrl, idx) => (
                              <div
                                key={idx}
                                className="group relative rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 hover:border-violet-500/60 transition-all aspect-square flex flex-col"
                              >
                                <img
                                  src={imgUrl}
                                  alt={`Product image ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                  }}
                                />
                                <div className="absolute top-1 left-1 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">
                                  #{idx + 1} {idx === 0 ? "Ảnh chính" : ""}
                                </div>
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 p-1">
                                  {idx > 0 && (
                                    <button
                                      type="button"
                                      title="Di chuyển lên đầu"
                                      onClick={() => handleMoveImage(idx, "up")}
                                      className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {idx < editForm.images!.length - 1 && (
                                    <button
                                      type="button"
                                      title="Di chuyển xuống"
                                      onClick={() => handleMoveImage(idx, "down")}
                                      className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    title="Xem kích thước lớn"
                                    onClick={() => setPreviewMediaUrl({ url: imgUrl, type: "image" })}
                                    className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    title="Xóa ảnh này"
                                    onClick={() => handleRemoveImage(idx)}
                                    className="p-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-6 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 text-center space-y-2">
                            <ImageIcon className="w-8 h-8 text-zinc-600 mx-auto" />
                            <p className="text-xs text-zinc-400">
                              Chưa có hình ảnh sản phẩm nào. Hãy tải lên file ảnh hoặc nhập đường dẫn URL ảnh sản phẩm thực tế.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* VIDEOS SUB-TAB */}
                    {activeAssetSubTab === "videos" && (
                      <div className="space-y-4">
                        {/* Video Upload & URL bar */}
                        <div className="flex flex-col sm:flex-row gap-2">
                          <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-semibold shrink-0 transition-colors">
                            {isUploadingAsset ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Upload className="w-3.5 h-3.5" />
                            )}
                            Tải Video Từ Máy Tính
                            <input
                              type="file"
                              accept="video/*"
                              className="hidden"
                              disabled={isUploadingAsset}
                              onChange={(e) => handleUploadAssetFile(e, "video")}
                            />
                          </label>
                          <div className="flex-1 flex gap-2">
                            <div className="relative flex-1">
                              <Link2 className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                placeholder="Dán đường dẫn (URL) video clip sản phẩm (MP4/WebM)..."
                                value={newVideoUrlInput}
                                onChange={(e) => setNewVideoUrlInput(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleAddVideoUrl}
                              className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium shrink-0"
                            >
                              Thêm URL
                            </button>
                          </div>
                        </div>

                        {/* Video List / Grid */}
                        {editForm.videos && editForm.videos.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-64 overflow-y-auto pr-1">
                            {editForm.videos.map((vidUrl, idx) => (
                              <div
                                key={idx}
                                className="relative rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 flex flex-col p-2 space-y-2"
                              >
                                <video
                                  src={vidUrl}
                                  controls
                                  className="w-full h-28 object-cover rounded-lg bg-black"
                                />
                                <div className="flex items-center justify-between pt-1">
                                  <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[160px]">
                                    Video #{idx + 1}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveVideo(idx)}
                                    className="p-1 rounded bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 text-xs flex items-center gap-1"
                                  >
                                    <Trash2 className="w-3 h-3" /> Xóa
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-6 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 text-center space-y-2">
                            <FileVideo className="w-8 h-8 text-zinc-600 mx-auto" />
                            <p className="text-xs text-zinc-400">
                              Chưa có video clip sản phẩm nào. Hãy tải lên file MP4 hoặc nhập URL video thực tế để làm visual chính cho AI Video.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setModalTab("view")}
                      className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={updateMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg shadow-violet-600/20"
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Lưu Thay Đổi
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Script Preview Modal (Script Engine 2.0) */}
      {activeScriptModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl relative">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-zinc-800/80 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Script Engine 2.0
                  </span>
                  <span className="text-xs text-zinc-400 font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" /> {activeScriptModal.duration} Giây
                  </span>
                </div>
                <h3 className="text-lg font-extrabold text-zinc-100">{activeScriptModal.title}</h3>
              </div>
              <button
                onClick={() => setActiveScriptModal(null)}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Hook & CTA Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                <span className="text-[10px] uppercase font-bold text-amber-400 block">Hook 1-3s (Mở Đầu Nổi Bật)</span>
                <p className="text-amber-200 font-semibold italic">&quot;{activeScriptModal.hook}&quot;</p>
              </div>
              <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/30 space-y-1">
                <span className="text-[10px] uppercase font-bold text-sky-400 block">Call To Action (CTA)</span>
                <p className="text-sky-200 font-medium">{activeScriptModal.cta}</p>
              </div>
            </div>

            {/* Scenes List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                <span>Chi Tiết Phân Cảnh ({activeScriptModal.scenes?.length || 0} Cảnh)</span>
                <span className="text-[11px] text-zinc-500 normal-case">Tự động tối ưu TTS & On-screen Text</span>
              </h4>

              <div className="space-y-3">
                {(activeScriptModal.scenes || []).map((scene) => (
                  <div
                    key={scene.sceneNumber}
                    className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3"
                  >
                    {/* Scene Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-zinc-800/50 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          Cảnh #{scene.sceneNumber}
                        </span>
                        <span className="text-xs font-semibold text-zinc-400">
                          {scene.startTime}s - {scene.endTime}s ({scene.duration}s)
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 uppercase">
                        {scene.mediaType}
                      </span>
                    </div>

                    {/* Scene Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="md:col-span-2 space-y-1 bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80">
                        <span className="text-[10px] uppercase font-bold text-emerald-400 block">Lời thoại TTS (Voiceover)</span>
                        <p className="text-zinc-200 leading-relaxed font-medium">{scene.narration}</p>
                      </div>

                      <div className="space-y-1 bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80">
                        <span className="text-[10px] uppercase font-bold text-amber-300 block">On-Screen Subtitle</span>
                        <p className="text-amber-200 font-extrabold tracking-wide uppercase">{scene.onScreenText}</p>
                      </div>
                    </div>

                    <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/50 text-xs">
                      <span className="text-[10px] uppercase font-bold text-violet-400 block">Chỉ dẫn hình ảnh (Visual Direction)</span>
                      <p className="text-zinc-300 italic">{scene.visualDirection}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Action */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-zinc-800">
              <button
                onClick={() => setActiveScriptModal(null)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold"
              >
                Đóng Preview
              </button>

              <button
                onClick={() => handleGenerateVideoFromScript(activeScriptModal.id)}
                disabled={generatingVideoScriptId === activeScriptModal.id}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-lg shadow-violet-600/30 transition-all"
              >
                {generatingVideoScriptId === activeScriptModal.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Video className="w-4 h-4" />
                )}
                Tạo Video Từ Kịch Bản 2.0
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Preview Modal for Images / Videos */}
      {previewMediaUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center justify-center">
            <button
              onClick={() => setPreviewMediaUrl(null)}
              className="absolute -top-10 right-0 p-2 text-zinc-400 hover:text-white bg-zinc-900/80 rounded-full"
            >
              <X className="w-6 h-6" />
            </button>
            {previewMediaUrl.type === "image" ? (
              <img
                src={previewMediaUrl.url}
                alt="Preview"
                className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl border border-zinc-800"
              />
            ) : (
              <video
                src={previewMediaUrl.url}
                controls
                autoPlay
                className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl border border-zinc-800 bg-black"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
