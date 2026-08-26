export const CONTENT_TYPES = [
  'product_review',
  'problem_solution',
  'comparison',
  'listicle',
  'educational',
  'storytelling',
  'testimonial',
  'myth_busting',
  'use_case',
  'value_for_money',
  'pros_cons',
  'FAQ',
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

export interface RawContentIdeaItem {
  title: string;
  description: string;
  contentType: ContentType | string;
  marketingAngle: string;
  targetAudience: string;
  painPoint: string;
  keyMessage: string;
  hook: string;
  recommendedCTA: string;
  priority?: number;
}

export interface ContentIdeaResponse {
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
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentStrategyGenerateResult {
  success: boolean;
  jobId?: string;
  count: number;
  ideas: ContentIdeaResponse[];
  error?: {
    code: string;
    message: string;
  };
}

export interface ContentStrategyJobPayload {
  productId: string;
}
