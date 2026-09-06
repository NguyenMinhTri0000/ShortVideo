import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../database/prisma.service';
import type {
  RawProductData,
  AiProductAnalysis,
  MarketingAngle,
} from './types/product-research.types';

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

type OpenAICompatibleResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const PRODUCT_ANALYSIS_PROMPT = `
You are a senior product marketing strategist. Analyze the following product information and generate structured marketing insights.

IMPORTANT ENGINEERING & TRUTH RULES:
1. Do NOT invent factual product specifications, prices, warranties, certifications, model numbers, dimensions, or technical numbers.
2. Separate FACTUAL DATA (from product info) from your AI MARKETING INSIGHTS (target audience, hooks, marketing angles).
3. If factual data is missing, keep empty array [] or null.
4. Respond in Vietnamese.
5. Return ONLY a valid JSON object matching the requested schema. No markdown code blocks, no explanation text outside JSON.

Product Information:
---
{PRODUCT_DATA}
---

Return this exact JSON structure:
{
  "summary": "Concise 2-3 sentence overview of the product",
  "category": "Standard product category (e.g. Kitchen Appliance, Electronics, Fashion) or null",
  "features": ["List of key physical or functional features based strictly on provided data"],
  "benefits": ["Derived customer benefits of using this product"],
  "sellingPoints": ["Key selling points / unique value propositions"],
  "usp": ["Unique selling points that differentiate this product"],
  "targetAudience": ["Specific buyer personas / ideal customer profiles"],
  "useCases": ["Real-world scenarios and situations where this product is useful"],
  "painPoints": ["Customer pain points or problems this product solves"],
  "pros": ["Major advantages and positive aspects"],
  "cons": ["Potential limitations or drawbacks to consider"],
  "marketingAngles": [
    {
      "title": "Short marketing angle title (e.g. 'Busy Office Workers')",
      "description": "Brief strategy explanation",
      "hook": "Attention-grabbing video hook opening line (under 15 words)"
    }
  ]
}
`.trim();

@Injectable()
export class ProductAnalysisService {
  private readonly logger = new Logger(ProductAnalysisService.name);

  constructor(
    private prisma: PrismaService,
    private llmService: LlmService,
  ) {}

  /**
   * Analyze raw product data with LLM and return validated AiProductAnalysis.
   * Includes safe retries on invalid JSON.
   */
  async analyzeProduct(rawData: RawProductData): Promise<AiProductAnalysis> {
    this.logger.log(
      `[AIAnalysis] Starting AI product analysis for "${rawData.title}"`,
    );

    const { provider, apiKey, model } =
      await this.llmService.getActiveProviderConfig();

    if (!apiKey) {
      this.logger.warn(
        '[AIAnalysis] No API key configured. Returning raw analysis fallback.',
      );
      return this.fallbackFromRaw(rawData);
    }

    const productSummaryText = this.buildPromptContext(rawData);
    const prompt = PRODUCT_ANALYSIS_PROMPT.replace(
      '{PRODUCT_DATA}',
      productSummaryText,
    );

    // Attempt 1
    try {
      const responseText = await this.callLlm(provider, apiKey, model, prompt);
      const parsed = this.parseAndValidateResponse(responseText);
      if (parsed) return parsed;
    } catch (err) {
      this.logger.warn(
        `[AIAnalysis] Attempt 1 failed: ${err instanceof Error ? err.message : String(err)}. Retrying...`,
      );
    }

    // Attempt 2 (Retry with strict JSON instruction)
    try {
      const retryPrompt = `${prompt}\n\nSTRICT NOTICE: Previous output was invalid. Reply strictly with raw valid JSON only!`;
      const responseText = await this.callLlm(
        provider,
        apiKey,
        model,
        retryPrompt,
      );
      const parsed = this.parseAndValidateResponse(responseText);
      if (parsed) return parsed;
    } catch (retryErr) {
      this.logger.error(
        `[AIAnalysis] Attempt 2 failed: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`,
      );
    }

    this.logger.warn(
      '[AIAnalysis] AI response parsing failed after retries. Using raw fallback.',
    );
    return this.fallbackFromRaw(rawData);
  }

  private buildPromptContext(rawData: RawProductData): string {
    const parts: string[] = [];

    if (rawData.title) parts.push(`Tên sản phẩm: ${rawData.title}`);
    if (rawData.brand) parts.push(`Thương hiệu: ${rawData.brand}`);
    if (rawData.category) parts.push(`Danh mục: ${rawData.category}`);
    if (rawData.price)
      parts.push(`Giá bán: ${rawData.price} ${rawData.currency || ''}`);
    if (rawData.originalPrice) parts.push(`Giá gốc: ${rawData.originalPrice}`);
    if (rawData.discountPercent != null)
      parts.push(`Giảm giá: ${rawData.discountPercent}%`);
    if (rawData.rating != null)
      parts.push(
        `Đánh giá: ${rawData.rating}/5 (${rawData.reviewCount || 0} lượt đánh giá)`,
      );

    if (rawData.description) {
      parts.push(`Mô tả chi tiết: ${rawData.description.substring(0, 2500)}`);
    }

    if (rawData.features && rawData.features.length > 0) {
      parts.push(`Tính năng nổi bật: ${rawData.features.join('; ')}`);
    }

    if (
      rawData.specifications &&
      Object.keys(rawData.specifications).length > 0
    ) {
      const specsStr = Object.entries(rawData.specifications)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ');
      parts.push(`Thông số kỹ thuật: ${specsStr}`);
    }

    parts.push(`URL: ${rawData.productUrl}`);

    return parts.join('\n');
  }

  private async callLlm(
    provider: string,
    apiKey: string,
    model: string,
    prompt: string,
  ): Promise<string> {
    const openAIBaseUrl = (): string => {
      const urls: Record<string, string> = {
        groq: 'https://api.groq.com/openai/v1/chat/completions',
        openai: 'https://api.openai.com/v1/chat/completions',
        deepseek: 'https://api.deepseek.com/v1/chat/completions',
        moonshot: 'https://api.moonshot.cn/v1/chat/completions',
        qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        grok: 'https://api.x.ai/v1/chat/completions',
        volcengine: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      };
      return urls[provider] || '';
    };

    const defaultModel = (): string => {
      const models: Record<string, string> = {
        groq: 'llama-3.3-70b-versatile',
        openai: 'gpt-4o-mini',
        deepseek: 'deepseek-chat',
        moonshot: 'moonshot-v1-8k',
        qwen: 'qwen-max',
        azure: 'gpt-35-turbo',
        grok: 'grok-4.3',
        volcengine: 'doubao-seed-2-1-turbo-260628',
      };
      return models[provider] || '';
    };

    if (provider === 'gemini') {
      const targetModel = model || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
          },
        }),
      });
      if (!response.ok) {
        throw new Error(
          `Gemini API error ${response.status}: ${await response.text()}`,
        );
      }
      const data = (await response.json()) as GeminiResponse;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) throw new Error('Gemini returned empty response');
      return text;
    }

    if (provider === 'azure') {
      const baseUrl = await this.getAzureBaseUrl();
      const url = `${baseUrl}/openai/deployments/${model}/chat/completions?api-version=2024-08-01-preview`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
        }),
      });
      if (!response.ok) {
        throw new Error(
          `Azure API error ${response.status}: ${await response.text()}`,
        );
      }
      const data = (await response.json()) as OpenAICompatibleResponse;
      return data.choices?.[0]?.message?.content || '';
    }

    const url = openAIBaseUrl();
    if (!url) {
      throw new Error(`Unsupported LLM provider: ${provider}`);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || defaultModel(),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `${provider} API error ${response.status}: ${await response.text()}`,
      );
    }
    const data = (await response.json()) as OpenAICompatibleResponse;
    return data.choices?.[0]?.message?.content || '';
  }

  private async getAzureBaseUrl(): Promise<string> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'azure_base_url' },
    });
    return setting?.value || '';
  }

  private parseAndValidateResponse(text: string): AiProductAnalysis | null {
    const cleaned = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .replace(/<think\b[^>]*>.*?<\/think>/gis, '')
      .trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    try {
      const obj = JSON.parse(jsonMatch[0]);
      return {
        summary: typeof obj.summary === 'string' ? obj.summary.trim() : null,
        category: typeof obj.category === 'string' ? obj.category.trim() : null,
        features: this.toStringArray(obj.features),
        benefits: this.toStringArray(obj.benefits),
        sellingPoints: this.toStringArray(obj.sellingPoints),
        usp: this.toStringArray(obj.usp),
        targetAudience: this.toStringArray(obj.targetAudience),
        useCases: this.toStringArray(obj.useCases),
        painPoints: this.toStringArray(obj.painPoints),
        pros: this.toStringArray(obj.pros),
        cons: this.toStringArray(obj.cons),
        marketingAngles: this.toMarketingAngles(obj.marketingAngles),
      };
    } catch {
      return null;
    }
  }

  private fallbackFromRaw(rawData: RawProductData): AiProductAnalysis {
    return {
      summary: rawData.description
        ? rawData.description.substring(0, 300)
        : rawData.title,
      category: rawData.category || null,
      features: rawData.features || [],
      benefits: [],
      sellingPoints: rawData.features ? rawData.features.slice(0, 5) : [],
      usp: [],
      targetAudience: [],
      useCases: [],
      painPoints: [],
      pros: [],
      cons: [],
      marketingAngles: [
        {
          title: 'Tổng quan sản phẩm',
          description: `Giới thiệu sản phẩm ${rawData.title || ''}`,
          hook: `Khám phá ngay ${rawData.title || 'sản phẩm hot nhât'}!`,
        },
      ],
    };
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item) => typeof item === 'string' && item.trim())
      .map((item) => String(item).trim());
  }

  private toMarketingAngles(value: unknown): MarketingAngle[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item) =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.title === 'string',
      )
      .map((item: any) => ({
        title: String(item.title || '').trim(),
        description: String(item.description || '').trim(),
        hook: String(item.hook || '').trim(),
      }));
  }
}
