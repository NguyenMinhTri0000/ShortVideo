/**
 * Product Research Types
 *
 * Shared type definitions for the product research pipeline:
 * raw extraction → AI analysis → Content Brief → final result.
 */

/** Normalized raw product data extracted from a web page */
export interface RawProductData {
  title: string | null;
  brand: string | null;
  category: string | null;
  description: string | null;
  price: string | null;
  originalPrice: string | null;
  currency: string | null;
  discountPercent: number | null;
  rating: number | null;
  reviewCount: number | null;
  images: string[];
  videos: string[];
  features: string[];
  specifications: Record<string, string>;
  productUrl: string;
  sourcePlatform: string;
}

/** A single marketing angle produced by AI analysis */
export interface MarketingAngle {
  title: string;
  description: string;
  hook: string;
}

/** AI-generated product marketing insights */
export interface AiProductAnalysis {
  summary: string | null;
  category: string | null;
  features: string[];
  benefits: string[];
  usp: string[];
  sellingPoints: string[];
  targetAudience: string[];
  useCases: string[];
  painPoints: string[];
  pros: string[];
  cons: string[];
  marketingAngles: MarketingAngle[];
}

/** Reusable Product Content Brief structure for AI script & strategy generation */
export interface ProductContentBrief {
  product: string;
  brand?: string | null;
  targetAudience: string;
  mainPainPoint: string;
  mainBenefit: string;
  sellingPoints: string[];
  marketingAngle: string;
  recommendedHook: string;
  recommendedCTA: string;
}

/** Research status enum values */
export enum ResearchStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  RESEARCHING = 'researching',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIAL = 'partial',
}

/** Final product research result returned by the API */
export interface ProductResearchResult {
  success: boolean;
  jobId?: string;
  product?: {
    id: string;
    name: string;
    brand?: string | null;
    category?: string | null;
    description: string | null;
    price: string | null;
    originalPrice?: string | null;
    currency: string;
    discountPercent?: number | null;
    rating?: number | null;
    reviewCount?: number | null;
    affiliateUrl: string;
    sourceUrl: string | null;
    sourcePlatform: string | null;
    images: string[];
    videos: string[];
    features: string[];
    specifications: Record<string, any> | null;
    benefits: string[];
    pros: string[];
    cons: string[];
    targetAudience: string | null;
    useCases: string[];
    usp: string[];
    painPoints: string[];
    marketingAngles: MarketingAngle[] | null;
    contentBrief: ProductContentBrief | null;
    researchStatus: string | null;
    researchError?: string | null;
    researchedAt: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  };
  error?: {
    code: string;
    message: string;
  };
}
