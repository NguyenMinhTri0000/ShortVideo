import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { LlmService } from '../llm/llm.service';
import { QueueService, type VideoJobConfig } from '../queue/queue.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  CONTENT_TYPES,
  type ContentIdeaResponse,
  type ContentStrategyGenerateResult,
  type ContentStrategyJobPayload,
  type RawContentIdeaItem,
} from './types/content-idea.types';

const CONTENT_STRATEGY_PROMPT = `
Bạn là một Giám đốc Chiến lược Nội dung (Content Strategy Director) chuyên về video ngắn (TikTok, Facebook Reels, YouTube Shorts).
Dựa trên thông tin nghiên cứu sản phẩm đã được trích xuất thực tế dưới đây, hãy lập chiến lược nội dung và đề xuất từ 10 đến 20 Ý TƯỞNG NỘI DUNG (Content Ideas) khác nhau để làm video tiếp thị sản phẩm.

==================================================
QUY TẮC AN TOÀN AI VÀ TÍNH XÁC THỰC DỮ LIỆU (FACTUAL ACCURACY):
==================================================
1. KHÔNG ĐƯỢC TỰ BỊA TẠO thông số kỹ thuật, giá cả, xuất xứ, chứng nhận, mô hình hay tính năng sản phẩm không có trong dữ liệu nghiên cứu.
2. TẤT CẢ thông tin thực tế về sản phẩm PHẢI xuất phát từ DỮ LIỆU NGHIÊN CỨU SẢN PHẨM bên dưới.
3. Phân biệt rõ:
   - DỮ LIỆU THỰC TẾ (Factual Product Data): Tính năng, lợi ích, giá, nhược điểm thực tế.
   - GÓC NHÌN SÁNG TẠO (Creative Angles): Cách tiếp cận khán giả, câu hỏi gợi mở, kịch bản tình huống.

==================================================
YÊU CẦU ĐA DẠNG NỘI DUNG (CONTENT DIVERSITY):
==================================================
Tạo ra 10 - 20 ý tưởng đa dạng góc nhìn. KHÔNG tạo các bài review lặp đi lặp lại.
Sử dụng đa dạng các loại contentType sau:
- product_review: Đánh giá tổng quan hoặc trải nghiệm
- problem_solution: Đặt vấn đề nỗi đau và giải pháp
- comparison: So sánh với phương pháp cũ hoặc giải pháp khác
- listicle: Danh sách (Top 3 lý do, 3 mẹo...)
- educational: Hướng dẫn mẹo sử dụng, kiến thức hữu ích
- storytelling: Câu chuyện thực tế/tình huống thường gặp
- testimonial: Góc nhìn người dùng phản hồi
- myth_busting: Giải mã hiểu lầm phổ biến
- use_case: Kịch bản sử dụng thực tế theo hoàn cảnh
- value_for_money: Phân tích đáng tiền hay không
- pros_cons: Phân tích ưu nhược điểm thẳng thắn
- FAQ: Giải đáp thắc mắc thường gặp

==================================================
CẤU TRÚC MỖI Ý TƯỞNG (IDEA QUALITY):
==================================================
Mỗi ý tưởng trong mảng JSON phải chứa đúng các trường:
1. title: Tiêu đề video cụ thể, hấp dẫn, tò mò (không dùng tiêu đề chung chung)
2. description: Mô tả chi tiết nội dung video và kịch bản bối cảnh hình ảnh
3. contentType: Một trong các giá trị enum nêu trên
4. marketingAngle: Góc độ tiếp thị khai thác (ví dụ: tiết kiệm thời gian, tối ưu chi phí, sự tiện lợi)
5. targetAudience: Đối tượng người xem cụ thể hướng tới
6. painPoint: Nỗi đau hoặc vấn đề người xem đang gặp phải
7. keyMessage: Thông điệp cốt lõi cần truyền tải
8. hook: Câu mở đầu (Hook) gây chú ý mạnh trong 3-5 giây đầu (dưới 15 từ)
9. recommendedCTA: Kêu gọi hành động phù hợp (CTA)
10. priority: Mức độ ưu tiên thương mại từ 1 đến 5 (1 = cao nhất)

DỮ LIỆU NGHIÊN CỨU SẢN PHẨM:
---
{PRODUCT_RESEARCH_DATA}
---

Yêu cầu trả về duy nhất một mảng JSON thuần túy (JSON Array), KHÔNG chứa văn bản giải thích bên ngoài, KHÔNG bọc trong markdown block.
Ví dụ định dạng trả về:
[
  {
    "title": "2.5 triệu mua nồi Philips có đáng không?",
    "description": "Video phân tích thực tế dành cho gia đình nhỏ băn khoăn về giá trị sử dụng so với số tiền bỏ ra.",
    "contentType": "value_for_money",
    "marketingAngle": "Phân tích giá trị sử dụng thực tế",
    "targetAudience": "Gia đình nhỏ và người đi làm bận rộn",
    "painPoint": "Không biết có nên bỏ số tiền lớn cho nồi chiên không",
    "keyMessage": "Giá trị bền bỉ và tiện lợi hoàn toàn xứng đáng với mức giá",
    "hook": "2.5 triệu cho một chiếc nồi chiên, liệu có thực sự đáng tiền?",
    "recommendedCTA": "Bấm vào link bên dưới để xem ưu đãi giá mới nhất",
    "priority": 1
  }
]
`.trim();

@Injectable()
export class ContentStrategyService {
  private readonly logger = new Logger(ContentStrategyService.name);

  constructor(
    private prisma: PrismaService,
    private llmService: LlmService,
    private queueService: QueueService,
    @InjectQueue('content-strategy')
    private strategyQueue?: Queue<ContentStrategyJobPayload>,
  ) {}

  /**
   * Main entrypoint for content idea generation.
   * Can be enqueued or executed directly.
   */
  async generateContentIdeas(
    productId: string,
  ): Promise<ContentStrategyGenerateResult> {
    this.logger.log(`[ContentStrategy] Starting idea generation for productId=${productId}`);

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    let jobId: string | undefined;

    // Enqueue if BullMQ queue is connected
    if (this.strategyQueue) {
      try {
        const job = await this.strategyQueue.add(
          'generate-content-ideas',
          { productId },
          { attempts: 2, backoff: 5000, removeOnComplete: 100, removeOnFail: 200 },
        );
        jobId = job.id;
        this.logger.log(`[Worker] Enqueued content strategy job ${jobId} for product ${productId}`);
      } catch (queueErr) {
        this.logger.warn(
          `[Worker] Redis queue enqueue failed, executing content strategy inline: ${queueErr}`,
        );
      }
    }

    try {
      const ideas = await this.executeStrategyPipeline(productId);

      return {
        success: true,
        jobId,
        count: ideas.length,
        ideas,
      };
    } catch (err) {
      this.logger.error(`[ContentStrategy] Top-level failure in generateContentIdeas: ${err}`);
      if (err instanceof NotFoundException) throw err;
      throw new BadRequestException('Không thể khởi tạo ý tưởng nội dung. Vui lòng kiểm tra lại dữ liệu sản phẩm.');
    }
  }

  /**
   * AI Strategy Pipeline execution:
   * Build research context -> Query LLM -> Parse & Validate JSON -> Persist ideas
   */
  async executeStrategyPipeline(
    productId: string,
  ): Promise<ContentIdeaResponse[]> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new NotFoundException('Không tìm thấy sản phẩm');
      }

      const { provider, apiKey, model } =
        await this.llmService.getActiveProviderConfig();

      let rawIdeas: RawContentIdeaItem[] = [];

      if (apiKey) {
        try {
          const researchContext = this.buildResearchContext(product);
          const prompt = CONTENT_STRATEGY_PROMPT.replace(
            '{PRODUCT_RESEARCH_DATA}',
            researchContext,
          );
          const responseText = await this.callLlm(provider, apiKey, model, prompt);
          rawIdeas = this.parseAndValidateResponse(responseText);
        } catch (err) {
          this.logger.warn(
            `[ContentStrategy] LLM API call or context building failed (${err instanceof Error ? err.message : String(err)}). Falling back to rule-based research synthesis.`,
          );
        }
      } else {
        this.logger.warn(
          '[ContentStrategy] No LLM API key configured. Using rule-based research synthesis fallback.',
        );
      }

      if (rawIdeas.length === 0) {
        rawIdeas = this.buildFallbackIdeas(product);
      }

      // Clear old draft ideas for this product if re-generating (catch DB error if linked scripts exist)
      try {
        await this.prisma.contentIdea.deleteMany({
          where: { productId, status: 'draft' },
        });
      } catch (dbErr) {
        this.logger.warn(
          `[ContentStrategy] Unable to clear previous draft ideas for product ${productId}: ${dbErr}`,
        );
      }

      // Save newly generated ideas into DB with safe individual creation
      const savedIdeas = [];
      for (let index = 0; index < rawIdeas.length; index++) {
        const item = rawIdeas[index];
        try {
          const created = await this.prisma.contentIdea.create({
            data: {
              productId,
              title: item.title || 'Ý tưởng nội dung',
              description: item.description || item.title || 'Mô tả ý tưởng',
              contentType: this.normalizeContentType(item.contentType),
              marketingAngle: item.marketingAngle || 'Tổng quan',
              targetAudience: item.targetAudience || 'Khách hàng mục tiêu',
              painPoint: item.painPoint || 'Vấn đề thực tế',
              keyMessage: item.keyMessage || item.title || 'Thông điệp cốt lõi',
              hook: item.hook || item.title || 'Hook mở đầu',
              recommendedCTA: item.recommendedCTA || 'Xem thêm chi tiết',
              priority: item.priority && item.priority >= 1 && item.priority <= 5 ? item.priority : (index % 5) + 1,
              status: 'draft',
            },
          });
          savedIdeas.push(created);
        } catch (createErr) {
          this.logger.error(
            `[ContentStrategy] Failed to persist idea index ${index} for product ${productId}: ${createErr}`,
          );
        }
      }

      this.logger.log(
        `[ContentStrategy] Successfully created ${savedIdeas.length} content ideas for product ${productId}`,
      );

      return savedIdeas.map((idea) => this.mapToResponse(idea));
    } catch (topErr) {
      this.logger.error(
        `[ContentStrategy] Unhandled exception in executeStrategyPipeline for productId=${productId}: ${topErr}`,
      );
      if (topErr instanceof NotFoundException) throw topErr;
      const product = await this.prisma.product.findUnique({ where: { id: productId } });
      if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');
      const fallbackIdeas = this.buildFallbackIdeas(product);
      return fallbackIdeas.map((item, index) => ({
        id: `fallback-${Date.now()}-${index}`,
        productId,
        title: item.title,
        description: item.description,
        contentType: item.contentType,
        marketingAngle: item.marketingAngle,
        targetAudience: item.targetAudience,
        painPoint: item.painPoint,
        keyMessage: item.keyMessage,
        hook: item.hook,
        recommendedCTA: item.recommendedCTA,
        priority: item.priority ?? (index + 1),
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    }
  }

  async getContentIdeasByProduct(
    productId: string,
  ): Promise<ContentIdeaResponse[]> {
    const ideas = await this.prisma.contentIdea.findMany({
      where: { productId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
    return ideas.map((idea) => this.mapToResponse(idea));
  }

  async getContentIdeaById(id: string): Promise<ContentIdeaResponse> {
    const idea = await this.prisma.contentIdea.findUnique({
      where: { id },
    });
    if (!idea) {
      throw new NotFoundException('Không tìm thấy ý tưởng nội dung');
    }
    return this.mapToResponse(idea);
  }

  async deleteContentIdea(id: string): Promise<{ success: boolean }> {
    await this.getContentIdeaById(id);
    await this.prisma.contentIdea.delete({
      where: { id },
    });
    return { success: true };
  }

  /**
   * Content Idea -> Video Generation Integration:
   * Selects a ContentIdea, converts it into a full script context with Product + Brief,
   * creates an Idea and GenerationJob record, and triggers BullMQ Video Processor.
   */
  async generateVideoFromIdea(contentIdeaId: string, config: VideoJobConfig = {}) {
    const contentIdea = await this.prisma.contentIdea.findUnique({
      where: { id: contentIdeaId },
      include: { product: true },
    });

    if (!contentIdea) {
      throw new NotFoundException('Không tìm thấy ý tưởng nội dung');
    }

    const product = contentIdea.product;

    // Build complete context combining Product Research + Content Idea Strategy
    const richScriptPrompt = `
[CONTENT STRATEGY & MARKETING ANGLE]
Title: ${contentIdea.title}
Content Type: ${contentIdea.contentType}
Marketing Angle: ${contentIdea.marketingAngle}
Target Audience: ${contentIdea.targetAudience}
Pain Point Solved: ${contentIdea.painPoint}
Key Message: ${contentIdea.keyMessage}
Hook (Opening Line): ${contentIdea.hook}
Recommended CTA: ${contentIdea.recommendedCTA}
Visual / Concept Description: ${contentIdea.description}

[FACTUAL PRODUCT RESEARCH DATA]
Product Name: ${product.name}
Brand: ${product.brand || 'N/A'}
Category: ${product.category || 'N/A'}
Price: ${product.price ? `${product.price} ${product.currency}` : 'N/A'}
Key Features: ${product.features.join(', ') || 'N/A'}
Key Benefits: ${product.benefits.join(', ') || 'N/A'}
USP: ${product.usp.join(', ') || 'N/A'}
Target Audience: ${product.targetAudience || 'N/A'}
`.trim();

    // Mark content idea status as selected
    await this.prisma.contentIdea.update({
      where: { id: contentIdeaId },
      data: { status: 'selected' },
    });

    // Create Idea entity connected to product
    const idea = await this.prisma.idea.create({
      data: {
        title: contentIdea.title,
        topic: product.name,
        description: richScriptPrompt,
        language: 'vi',
        status: 'ready',
        productId: product.id,
      },
    });

    // Create GenerationJob record
    const job = await this.prisma.generationJob.create({
      data: {
        ideaId: idea.id,
        productId: product.id,
        status: 'queued',
        config: config as any,
      },
    });

    // Queue job to BullMQ video-generation queue
    await this.queueService.addVideoJob(
      job.id,
      idea.id,
      contentIdea.title,
      undefined,
      'vi',
      {
        ...config,
        productId: product.id,
      },
    );

    this.logger.log(
      `[ContentStrategy] Triggered video generation job ${job.id} for content idea ${contentIdeaId}`,
    );

    return {
      contentIdea: this.mapToResponse(contentIdea),
      idea,
      job,
    };
  }

  /**
   * Batch Video Generation:
   * Accepts product ID, optional list of contentIdeaIds (or takes top N priority ideas),
   * and triggers video generation jobs for all selected ideas concurrently.
   */
  async batchGenerateVideosFromIdeas(
    productId: string,
    ideaIds?: string[],
    config: VideoJobConfig = {},
    limit = 3,
  ) {
    let targetIdeaIds = ideaIds && ideaIds.length > 0 ? ideaIds : [];

    if (targetIdeaIds.length === 0) {
      const topIdeas = await this.prisma.contentIdea.findMany({
        where: { productId },
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        take: limit,
      });
      targetIdeaIds = topIdeas.map((idea) => idea.id);
    }

    if (targetIdeaIds.length === 0) {
      throw new BadRequestException('Không tìm thấy ý tưởng nội dung nào để tạo video');
    }

    this.logger.log(
      `[ContentStrategy] Starting batch video generation for ${targetIdeaIds.length} content ideas (productId=${productId})`,
    );

    const results = [];
    for (const id of targetIdeaIds) {
      try {
        const result = await this.generateVideoFromIdea(id, config);
        results.push(result);
      } catch (err) {
        this.logger.error(`[ContentStrategy] Batch generate failed for idea ${id}: ${err}`);
      }
    }

    return {
      success: true,
      count: results.length,
      jobs: results.map((r) => r.job),
      ideas: results.map((r) => r.contentIdea),
    };
  }

  // ---------------------------------------------------------------------------
  // Helper methods
  // ---------------------------------------------------------------------------

  private safeArrayJoin(val: any, delimiter = '; '): string {
    if (Array.isArray(val)) {
      const items = val.filter(
        (item) => item !== null && item !== undefined && String(item).trim().length > 0,
      );
      return items.length > 0 ? items.join(delimiter) : 'Không có';
    }
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
    return 'Không có';
  }

  private firstArrayItem(val: any, fallback: string): string {
    if (Array.isArray(val) && val.length > 0) {
      const first = val[0];
      if (first !== null && first !== undefined && String(first).trim().length > 0) {
        return String(first).trim();
      }
    }
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
    return fallback;
  }

  private buildResearchContext(product: any): string {
    const brief = product.contentBrief as any;
    const painPointsText = this.safeArrayJoin(product.painPoints);
    return `
Tên sản phẩm: ${product.name || 'Sản phẩm'}
Thương hiệu: ${product.brand || 'N/A'}
Danh mục: ${product.category || 'N/A'}
Mô tả: ${product.description || 'N/A'}
Giá bán: ${product.price ? `${product.price} ${product.currency || 'VND'}` : 'Chưa rõ'}
Tính năng nổi bật: ${this.safeArrayJoin(product.features)}
Lợi ích sử dụng: ${this.safeArrayJoin(product.benefits)}
Điểm bán hàng độc nhất (USP): ${this.safeArrayJoin(product.usp)}
Đối tượng khách hàng mục tiêu: ${product.targetAudience || brief?.targetAudience || 'Khách hàng quan tâm'}
Nỗi đau / Vấn đề cần giải quyết: ${painPointsText !== 'Không có' ? painPointsText : (brief?.mainPainPoint || 'Không có')}
Trường hợp sử dụng (Use cases): ${this.safeArrayJoin(product.useCases)}
Ưu điểm: ${this.safeArrayJoin(product.pros)}
Nhược điểm: ${this.safeArrayJoin(product.cons)}
`.trim();
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

    let responseText = '';

    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });
      if (!response.ok) {
        throw new Error(
          `Gemini API returned status ${response.status}: ${await response.text()}`,
        );
      }
      const data = await response.json();
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
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
          model: model || 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      });
      if (!response.ok) {
        throw new Error(
          `${provider} API returned status ${response.status}: ${await response.text()}`,
        );
      }
      const data = await response.json();
      responseText = data.choices?.[0]?.message?.content || '';
    }

    return responseText;
  }

  private parseAndValidateResponse(rawText: string): RawContentIdeaItem[] {
    if (!rawText || !rawText.trim()) return [];

    let cleaned = rawText.trim();
    cleaned = cleaned.replace(/```json/g, '').replace(/```/g, '').trim();

    // Locate first '[' and last ']' if extra narrative wrapped the response
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      cleaned = cleaned.substring(firstBracket, lastBracket + 1);
    }

    try {
      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) return [];

      const validItems: RawContentIdeaItem[] = [];
      for (const item of parsed) {
        if (
          typeof item === 'object' &&
          item !== null &&
          typeof item.title === 'string' &&
          item.title.trim().length > 0
        ) {
          validItems.push({
            title: item.title.trim(),
            description: item.description || item.title,
            contentType: item.contentType || 'product_review',
            marketingAngle: item.marketingAngle || 'Tổng quan sản phẩm',
            targetAudience: item.targetAudience || 'Khách hàng tiềm năng',
            painPoint: item.painPoint || 'Tìm kiếm giải pháp tốt',
            keyMessage: item.keyMessage || item.title,
            hook: item.hook || item.title,
            recommendedCTA: item.recommendedCTA || 'Xem thêm chi tiết bên dưới',
            priority: Number(item.priority) || 1,
          });
        }
      }
      return validItems;
    } catch (e) {
      this.logger.error(`[ContentStrategy] Failed to parse LLM JSON: ${e}`);
      return [];
    }
  }

  private normalizeContentType(typeInput: string): string {
    const lower = typeInput?.toLowerCase().trim() || '';
    for (const valid of CONTENT_TYPES) {
      if (lower.includes(valid) || valid.includes(lower)) {
        return valid;
      }
    }
    return 'product_review';
  }

  private mapToResponse(idea: any): ContentIdeaResponse {
    return {
      id: idea.id,
      productId: idea.productId,
      title: idea.title,
      description: idea.description,
      contentType: idea.contentType,
      marketingAngle: idea.marketingAngle,
      targetAudience: idea.targetAudience,
      painPoint: idea.painPoint,
      keyMessage: idea.keyMessage,
      hook: idea.hook,
      recommendedCTA: idea.recommendedCTA,
      priority: idea.priority,
      status: idea.status,
      createdAt: idea.createdAt,
      updatedAt: idea.updatedAt,
    };
  }

  private buildFallbackIdeas(product: any): RawContentIdeaItem[] {
    const pName = product.name || 'Sản phẩm';
    const pPrice = product.price ? `${product.price} ${product.currency || 'VND'}` : 'mức giá hiện tại';
    const mainAudience = product.targetAudience || 'người tiêu dùng hiện đại';
    const firstPain = this.firstArrayItem(product.painPoints, 'chưa tìm được giải pháp tối ưu');
    const firstBenefit = this.firstArrayItem(product.benefits, 'mang lại trải nghiệm tuyệt vời');
    const firstFeature = this.firstArrayItem(product.features, 'thiết kế thông minh');
    const firstUsp = this.firstArrayItem(product.usp, 'chất lượng vượt trội');

    return [
      {
        title: `${pPrice} mua ${pName} có thực sự đáng tiền?`,
        description: `Phân tích thực tế giá trị sử dụng và độ bền của ${pName} so với mức giá ${pPrice}.`,
        contentType: 'value_for_money',
        marketingAngle: 'Phân tích giá trị & ROI',
        targetAudience: mainAudience,
        painPoint: 'Lo lắng mua đắt hoặc không đúng nhu cầu',
        keyMessage: `Giá trị sử dụng và sự tiện lợi của ${pName} hoàn toàn tương xứng với chi phí`,
        hook: `${pPrice} cho chiếc ${pName} này, liệu có thực sự đáng xuống tiền?`,
        recommendedCTA: 'Nhấp ngay link góc dưới màn hình để xem ưu đãi giá hôm nay!',
        priority: 1,
      },
      {
        title: `Đánh giá thực tế ${pName} sau thời gian sử dụng`,
        description: `Review toàn diện về thiết kế, tính năng ${firstFeature} và trải nghiệm thực tế.`,
        contentType: 'product_review',
        marketingAngle: 'Đánh giá chân thực',
        targetAudience: mainAudience,
        painPoint: 'Cần góc nhìn khách quan trước khi quyết định mua',
        keyMessage: `${pName} nổi bật với ${firstFeature} và mang lại ${firstBenefit}`,
        hook: `Nếu bạn đang tính mua ${pName}, nhất định phải xem video này!`,
        recommendedCTA: 'Xem thêm thông số và đặt hàng tại link bên dưới.',
        priority: 1,
      },
      {
        title: `Giải pháp triệt để cho người gặp tình trạng ${firstPain}`,
        description: `Video tập trung phân tích nỗi đau của ${mainAudience} và cách ${pName} giải quyết triệt để.`,
        contentType: 'problem_solution',
        marketingAngle: 'Giải quyết nỗi đau',
        targetAudience: mainAudience,
        painPoint: firstPain,
        keyMessage: `${pName} là giải pháp tối ưu giúp bạn không còn lo lắng về ${firstPain}`,
        hook: `Có phải bạn đang mệt mỏi vì ${firstPain}? Đừng lo, đây là giải pháp!`,
        recommendedCTA: 'Trải nghiệm ngay sản phẩm chính hãng ở link bên dưới!',
        priority: 1,
      },
      {
        title: `3 lý do ${pName} là lựa chọn số 1 cho ${mainAudience}`,
        description: `Danh sách 3 điểm mạnh nhất (${firstUsp}, ${firstFeature}, ${firstBenefit}) giúp sản phẩm vượt trội.`,
        contentType: 'listicle',
        marketingAngle: 'Top tính năng vượt trội',
        targetAudience: mainAudience,
        painPoint: 'Phân vân giữa quá nhiều lựa chọn trên thị trường',
        keyMessage: `Ba lý do cốt lõi khiến ${pName} trở thành sản phẩm đáng mua nhất`,
        hook: `3 lý do khiến ${pName} tạo nên cơn sốt gần đây!`,
        recommendedCTA: 'Bấm mua ngay để nhận quà tặng kèm số lượng có hạn!',
        priority: 2,
      },
      {
        title: `Bật mí mẹo sử dụng ${pName} chuẩn nhất cho người mới`,
        description: `Hướng dẫn từng bước cách sử dụng và bảo quản ${pName} để phát huy tối đa hiệu quả.`,
        contentType: 'educational',
        marketingAngle: 'Hướng dẫn & Mẹo hữu ích',
        targetAudience: 'Người mới mua sản phẩm',
        painPoint: 'Chưa biết cách dùng đúng cách để đạt độ bền cao nhất',
        keyMessage: 'Sử dụng đúng cách giúp tăng x2 độ bền và tối ưu trải nghiệm',
        hook: 'Mới mua chiếc này về mà dùng sai cách là coi như bỏ! Xem ngay mẹo này!',
        recommendedCTA: 'Lưu lại video này và xem thông tin sản phẩm bên dưới nhé!',
        priority: 2,
      },
      {
        title: `Kịch bản sử dụng ${pName} trong sinh hoạt hàng ngày`,
        description: `Tình huống thực tế minh họa cách ${pName} hỗ trợ cuộc sống của ${mainAudience}.`,
        contentType: 'use_case',
        marketingAngle: 'Ứng dụng thực tế',
        targetAudience: mainAudience,
        painPoint: 'Chưa hình dung được sản phẩm sẽ hỗ trợ cuộc sống thế nào',
        keyMessage: `${pName} vừa vặn tuyệt đối cho không gian và thói quen sinh hoạt mỗi ngày`,
        hook: `Một ngày làm việc nhẹ nhàng hơn hẳn nhờ có thêm ${pName}!`,
        recommendedCTA: 'Tham khảo thêm chi tiết sản phẩm ở link nhé!',
        priority: 2,
      },
      {
        title: `So sánh ${pName} với các phương pháp cũ thông thường`,
        description: `Đặt lên bàn cân hiệu quả của ${pName} so với giải pháp truyền thống.`,
        contentType: 'comparison',
        marketingAngle: 'So sánh tối ưu',
        targetAudience: mainAudience,
        painPoint: 'Đang dùng phương pháp cũ tốn nhiều công sức và thời gian',
        keyMessage: `Chuyển sang ${pName} giúp tiết kiệm đáng kể thời gian và mang lại ${firstBenefit}`,
        hook: 'Vẫn dùng cách cũ? Thử ngay cách này nhanh gấp 3 lần!',
        recommendedCTA: 'Đổi mới trải nghiệm ngay hôm nay qua link dưới!',
        priority: 3,
      },
      {
        title: `Phân tích thẳng thắn Ưu & Nhược điểm của ${pName}`,
        description: `Nêu rõ các ưu điểm nổi bật và một số điểm cần lưu ý trước khi chọn mua.`,
        contentType: 'pros_cons',
        marketingAngle: 'Khách quan & Minh bạch',
        targetAudience: mainAudience,
        painPoint: 'Ngại quảng cáo thổi phồng sự thật',
        keyMessage: 'Nắm rõ cả ưu và nhược điểm giúp bạn đưa ra quyết định mua sắm thông minh',
        hook: 'Nhược điểm duy nhất của chiếc này bạn cần biết trước khi chốt đơn!',
        recommendedCTA: 'Xem ngay thông tin giá tốt ở link mô tả!',
        priority: 3,
      },
      {
        title: `Giải đáp 3 thắc mắc phổ biến nhất về ${pName}`,
        description: `Trả lời các câu hỏi về độ bền, cách vệ sinh và chính sách bảo hành.`,
        contentType: 'FAQ',
        marketingAngle: 'Giải đáp thắc mắc',
        targetAudience: mainAudience,
        painPoint: 'Còn vướng mắc lo lắng về bảo hành và sử dụng',
        keyMessage: 'Tất cả thắc mắc của bạn đều có câu trả lời rõ ràng và cam kết bảo hành uy tín',
        hook: 'Bạn vẫn còn lăn tăn về chiếc nồi này? Đây là câu trả lời!',
        recommendedCTA: 'Click link để được hỗ trợ và tư vấn chi tiết hơn nhé!',
        priority: 3,
      },
      {
        title: `Hiểu lầm thường gặp khi chọn mua ${pName}`,
        description: `Giải mã những định kiến hoặc sai lầm người dùng hay mắc phải khi chọn mua.`,
        contentType: 'myth_busting',
        marketingAngle: 'Góc nhìn chuyên gia',
        targetAudience: mainAudience,
        painPoint: 'Bị thông tin sai lệch làm bối rối',
        keyMessage: `Hiểu đúng về tính năng ${firstFeature} của ${pName} để chọn chuẩn xác`,
        hook: 'Đừng vội mua chiếc này nếu bạn chưa biết sự thật sau đây!',
        recommendedCTA: 'Tìm hiểu ngay tại đường link bên dưới!',
        priority: 3,
      },
    ];
  }
}
