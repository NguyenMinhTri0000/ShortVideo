/**
 * Product Research Types
 *
 * Shared type definitions for the product research pipeline:
 * raw extraction → AI analysis → final result.
 */

/** Normalized product data extracted from a web page */
export interface RawProductData {
  title: string | null;
  description: string | null;
  price: string | null;
  currency: string | null;
  images: string[];
  features: string[];
  productUrl: string;
}

/** A single marketing angle produced by AI analysis */
export interface MarketingAngle {
  title: string;
  description: string;
  hook: string;
}

/** AI-generated product analysis */
export interface AiProductAnalysis {
  category: string | null;
  features: string[];
  benefits: string[];
  usp: string[];
  targetAudience: string[];
  painPoints: string[];
  marketingAngles: MarketingAngle[];
}

/** Research status enum values (stored as string in Prisma) */
export enum ResearchStatus {
  PENDING = 'PENDING',
  RESEARCHING = 'RESEARCHING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/** Final product research result returned by the API */
export interface ProductResearchResult {
  success: boolean;
  product?: {
    id: string;
    name: string;
    description: string | null;
    price: string | null;
    currency: string;
    affiliateUrl: string;
    images: string[];
    features: string[];
    benefits: string[];
    targetAudience: string | null;
    usp: string[];
    painPoints: string[];
    category: string | null;
    marketingAngles: MarketingAngle[] | null;
    sourceUrl: string | null;
    researchStatus: string | null;
    researchedAt: Date | null;
  };
  error?: {
    code: string;
    message: string;
  };
}
