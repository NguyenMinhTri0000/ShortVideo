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
  _count?: {
    ideas: number;
    jobs: number;
  };
};

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [generatingProductId, setGeneratingProductId] = useState<string | null>(null);

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
                </div>

                {/* Info */}
                <h3 className="font-semibold text-zinc-100 text-lg line-clamp-1">
                  {product.name}
                </h3>
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
