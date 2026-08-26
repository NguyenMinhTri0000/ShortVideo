import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { LlmService } from '../llm/llm.service';
import { ProductSourceAdapter } from './adapters/product-source.adapter';
import { GenericProductAdapter } from './adapters/generic-product.adapter';
import type {
  RawProductData,
  AiProductAnalysis,
  ProductResearchResult,
  MarketingAngle,
} from './types/product-research.types';
import { ResearchStatus } from './types/product-research.types';

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
You are a product marketing analyst. Analyze the following product information and return a structured JSON object.

IMPORTANT RULES:
- Only use information that is present in the provided data.
- Do NOT invent price, specifications, certifications, warranty, performance numbers, discounts, reviews, or claims.
- If information is not available, use null or an empty array.
- Respond with ONLY the JSON object, no markdown code blocks, no explanation.

Product Information:
---
{PRODUCT_DATA}
---

Return this exact JSON structure:
{
  "category": "Product category (e.g. Kitchen Appliance, Electronics, Fashion) or null if unknown",
  "features": ["List of key product features extracted from the data"],
  "benefits": ["List of customer benefits derived from the features"],
  "usp": ["Unique selling points that differentiate this product"],
  "targetAudience": ["Who would buy this product"],
  "painPoints": ["Problems this product solves"],
  "marketingAngles": [
    {
      "title": "Short marketing angle title",
      "description": "Brief description of the angle",
      "hook": "Attention-grabbing opening line for a video"
    }
  ]
}

Respond in Vietnamese. Return ONLY valid JSON.
`.trim();

@Injectable()
export class ProductResearchService {
  private readonly logger = new Logger(ProductResearchService.name);
  private readonly adapters: ProductSourceAdapter[];

  constructor(
    private prisma: PrismaService,
    private llmService: LlmService,
  ) {
    // Register adapters in priority order.
    // Future platform-specific adapters (Shopee, TikTok Shop, Lazada)
    // should be inserted BEFORE the generic adapter.
    this.adapters = [new GenericProductAdapter()];
  }

  /**
   * Full research pipeline:
   * URL → validate → select adapter → extract → AI analyze → save → return
   */
  async researchProduct(url: string): Promise<ProductResearchResult> {
    this.logger.log(`Starting product research for: ${url}`);

    // 1. Select adapter
    const adapter = this.selectAdapter(url);
    if (!adapter) {
      return {
        success: false,
        error: {
          code: 'NO_ADAPTER',
          message: 'Không hỗ trợ URL này. Vui lòng thử URL khác.',
        },
      };
    }

    // 2. Create a pending product record
    let product = await this.prisma.product.create({
      data: {
        name: 'Đang nghiên cứu...',
        affiliateUrl: url,
        sourceUrl: url,
        researchStatus: ResearchStatus.RESEARCHING,
      },
    });

    try {
      // 3. Extract raw product data
      this.logger.log(`Using adapter "${adapter.name}" for extraction`);
      const rawData = await adapter.extract(url);
      this.logger.log(
        `Extraction complete: title="${rawData.title}", images=${rawData.images.length}`,
      );

      if (!rawData.title && !rawData.description) {
        throw new Error(
          'Không thể trích xuất thông tin sản phẩm từ trang này. Trang có thể không chứa dữ liệu sản phẩm hoặc đã chặn truy cập.',
        );
      }

      // 4. AI analysis
      let aiAnalysis: AiProductAnalysis | null = null;
      try {
        aiAnalysis = await this.analyzeWithAi(rawData);
        this.logger.log(`AI analysis complete: category="${aiAnalysis?.category}"`);
      } catch (aiError) {
        this.logger.warn(
          `AI analysis failed, proceeding with raw data only: ${aiError instanceof Error ? aiError.message : String(aiError)}`,
        );
        // AI failure is non-fatal — we still save the extracted data
      }

      // 5. Update product with extracted + analyzed data
      product = await this.prisma.product.update({
        where: { id: product.id },
        data: {
          name: rawData.title || 'Sản phẩm không tên',
          description: rawData.description,
          price: rawData.price,
          currency: rawData.currency || 'VND',
          affiliateUrl: url,
          images: rawData.images,
          features: aiAnalysis?.features || rawData.features || [],
          benefits: aiAnalysis?.benefits || [],
          targetAudience: aiAnalysis?.targetAudience?.join(', ') || null,
          sourceUrl: url,
          category: aiAnalysis?.category || null,
          usp: aiAnalysis?.usp || [],
          painPoints: aiAnalysis?.painPoints || [],
          marketingAngles: aiAnalysis?.marketingAngles
            ? (aiAnalysis.marketingAngles as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
          researchRawData: rawData as unknown as Prisma.InputJsonValue,
          researchStatus: ResearchStatus.COMPLETED,
          researchedAt: new Date(),
          researchError: null,
        },
      });

      this.logger.log(`Product saved: id=${product.id}, name="${product.name}"`);

      return {
        success: true,
        product: {
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          currency: product.currency,
          affiliateUrl: product.affiliateUrl,
          images: product.images,
          features: product.features,
          benefits: product.benefits,
          targetAudience: product.targetAudience,
          usp: (product as any).usp || [],
          painPoints: (product as any).painPoints || [],
          category: (product as any).category || null,
          marketingAngles: (product as any).marketingAngles as MarketingAngle[] | null,
          sourceUrl: (product as any).sourceUrl || null,
          researchStatus: (product as any).researchStatus || null,
          researchedAt: (product as any).researchedAt || null,
        },
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Product research failed: ${errorMessage}`);

      // Update product with error status
      await this.prisma.product
        .update({
          where: { id: product.id },
          data: {
            researchStatus: ResearchStatus.FAILED,
            researchError: errorMessage,
            name: 'Nghiên cứu thất bại',
          },
        })
        .catch((updateErr) => {
          this.logger.error(
            `Failed to update product error status: ${updateErr instanceof Error ? updateErr.message : String(updateErr)}`,
          );
        });

      return {
        success: false,
        error: {
          code: 'RESEARCH_FAILED',
          message: errorMessage,
        },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Adapter selection
  // ---------------------------------------------------------------------------

  private selectAdapter(url: string): ProductSourceAdapter | null {
    for (const adapter of this.adapters) {
      if (adapter.canHandle(url)) {
        return adapter;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // AI product analysis
  // ---------------------------------------------------------------------------

  private async analyzeWithAi(
    rawData: RawProductData,
  ): Promise<AiProductAnalysis> {
    const { provider, apiKey, model } =
      await this.llmService.getActiveProviderConfig();

    if (!apiKey) {
      throw new Error(
        'Chưa cấu hình API key cho AI. Vào Cài đặt để cấu hình.',
      );
    }

    // Build product data summary for the prompt
    const productSummary = [
      rawData.title ? `Tên sản phẩm: ${rawData.title}` : null,
      rawData.description
        ? `Mô tả: ${rawData.description.substring(0, 2000)}`
        : null,
      rawData.price ? `Giá: ${rawData.price} ${rawData.currency || ''}` : null,
      rawData.features.length > 0
        ? `Tính năng: ${rawData.features.join(', ')}`
        : null,
      `URL: ${rawData.productUrl}`,
    ]
      .filter(Boolean)
      .join('\n');

    const prompt = PRODUCT_ANALYSIS_PROMPT.replace(
      '{PRODUCT_DATA}',
      productSummary,
    );

    const resultText = await this.callLlm(provider, apiKey, model, prompt);
    return this.parseAiResponse(resultText);
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
        volcengine:
          'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
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
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
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
          temperature: 0.3,
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

    // OpenAI-compatible providers
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
        temperature: 0.3,
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

  // ---------------------------------------------------------------------------
  // AI response parsing & validation
  // ---------------------------------------------------------------------------

  private parseAiResponse(text: string): AiProductAnalysis {
    // Clean markdown code blocks if present
    let cleaned = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // Remove think blocks (some models include reasoning)
    cleaned = cleaned
      .replace(/<think\b[^>]*>.*?<\/think>/gis, '')
      .trim();

    // Try to extract JSON object from the text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      this.logger.warn('AI response does not contain JSON object');
      return this.emptyAnalysis();
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return this.validateAnalysis(parsed);
    } catch (err) {
      this.logger.warn(
        `Failed to parse AI JSON response: ${err instanceof Error ? err.message : String(err)}`,
      );
      return this.emptyAnalysis();
    }
  }

  private validateAnalysis(data: any): AiProductAnalysis {
    return {
      category:
        typeof data.category === 'string' ? data.category : null,
      features: this.toStringArray(data.features),
      benefits: this.toStringArray(data.benefits),
      usp: this.toStringArray(data.usp),
      targetAudience: this.toStringArray(data.targetAudience),
      painPoints: this.toStringArray(data.painPoints),
      marketingAngles: this.toMarketingAngles(data.marketingAngles),
    };
  }

  private emptyAnalysis(): AiProductAnalysis {
    return {
      category: null,
      features: [],
      benefits: [],
      usp: [],
      targetAudience: [],
      painPoints: [],
      marketingAngles: [],
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
      .map((item) => ({
        title: String(item.title || '').trim(),
        description: String(item.description || '').trim(),
        hook: String(item.hook || '').trim(),
      }));
  }
}
