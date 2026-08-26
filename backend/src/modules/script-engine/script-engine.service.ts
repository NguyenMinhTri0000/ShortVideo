import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { LlmService } from '../llm/llm.service';
import { QueueService, type VideoJobConfig } from '../queue/queue.service';
import {
  type MediaType,
  type RawScriptLlmOutput,
  type ScriptScene,
  type VideoScriptResponse,
} from './types/script-engine.types';

const SCRIPT_ENGINE_PROMPT = `
Bạn là một đạo diễn và biên kịch hàng đầu cho video ngắn tiếp thị tiếp thị liên kết (TikTok, YouTube Shorts, Reels).
Dhiệm vụ của bạn là dựa trên DỮ LIỆU NGHIÊN CỨU SẢN PHẨM và Ý TƯỞNG NỘI DUNG (Content Idea) được chọn để viết một KỊCH BẢN VIDEO NGẮN HOÀN CHỈNH, CHUẨN SẢN XUẤT.

==================================================
1. QUY TẮC AN TOÀN DỮ LIỆU VÀ TÍNH XÁC THỰC (FACTUAL ACCURACY - CỰC KỲ QUAN TRỌNG):
==================================================
- KHÔNG ĐƯỢC BỊA TẠO bất kỳ thông số kỹ thuật, công suất, dung tích, tính năng, giá trị hay xuất xứ nào không có trong dữ liệu nghiên cứu sản phẩm.
- Mọi tuyên bố thực tế (Factual Claims) trong lời thoại (Narration) và chữ trên màn hình (On-Screen Text) PHẢI căn cứ tuyệt đối vào dữ liệu thực tế bên dưới.

==================================================
2. YÊU CẦU TỐI ƯU VIDEO NGẮN (SHORT-FORM OPTIMIZATION):
==================================================
- Thời lượng khuyến nghị: 30 - 45 giây (tối thiểu 15s, tối đa 60s).
- Giọng văn (Narration): Tiếng Việt tự nhiên, conversational, đời thường, dễ đọc cho AI Voiceover (TTS). Tránh câu quá dài, tránh từ viết tắt kỳ lạ, tránh thuật ngữ marketing gượng gạo.
- 1-3 giây đầu tiên (HOOK) PHẢI cực kỳ gây tò mò, trực tiếp, đánh đúng nỗi đau hoặc băn khoăn.
- CẤM MỞ ĐẦU BẰNG: "Xin chào mọi người...", "Chào các bạn...", "Hôm nay mình sẽ..." hoặc các câu chào chung chung lãng phí thời gian.

==================================================
3. CẤU TRÚC KỊCH BẢN THEO LOẠI NỘI DUNG (CONTENT STRUCTURE):
==================================================
Cấu trúc các cảnh (scenes) phải bám sát theo loại nội dung (contentType):
- problem_solution: Hook -> Nỗi đau -> Giải pháp -> Lợi ích sản phẩm -> CTA
- comparison: Hook -> Phương án A -> Phương án B -> Điểm khác biệt -> Khuyên dùng -> CTA
- listicle: Hook -> Điểm 1 -> Điểm 2 -> Điểm 3 -> CTA
- product_review / value_for_money / pros_cons: Hook -> Ấn tượng đầu tiên -> Tính năng/Ưu nhược điểm -> Kết luận -> CTA
- educational / use_case / storytelling: Hook -> Tình huống/Mẹo -> Thực hành/Ứng dụng -> Kết quả -> CTA

==================================================
4. QUY TẮC CHO TỪNG CẢNH (SCENE RULES):
==================================================
Mỗi cảnh (scene) trong mảng "scenes" phải chứa:
- sceneNumber: Số thứ tự (1, 2, 3...)
- startTime: Thời điểm bắt đầu (giây, tính từ 0)
- endTime: Thời điểm kết thúc (giây)
- duration: Thời lượng cảnh (endTime - startTime)
- narration: Lời thoại đọc voiceover (Tiếng Việt tự nhiên, dễ đọc TTS)
- onScreenText: Chữ hiển thị nổi bật trên màn hình (ngắn gọn 3-8 từ, tóm tắt ý chính, KHÔNG chép lại toàn bộ lời thoại)
- visualDirection: Chỉ dẫn hình ảnh/bối cảnh cụ thể phù hợp với lời thoại (VD: "Show product hero image with fast zoom", "Close-up product control panel")
- mediaType: Loại media ưu tiên. Chọn duy nhất 1 trong các enum sau:
  * "product_image": Ảnh thực tế sản phẩm (ưu tiên cho các cảnh giới thiệu sản phẩm)
  * "product_video": Video thực tế sản phẩm
  * "stock_video": Video quay sẵn bối cảnh (người dùng, nhà bếp, đời sống)
  * "stock_image": Ảnh bối cảnh
  * "ai_image": Ảnh AI tạo ra
  * "text_only": Cảnh chỉ chứa chữ và màu nền

==================================================
THÔNG TIN ĐẦU VÀO:
==================================================
[Ý TƯỞNG NỘI DUNG (CONTENT IDEA)]
- Tiêu đề: {IDEA_TITLE}
- Loại nội dung (contentType): {IDEA_CONTENT_TYPE}
- Góc tiếp thị: {IDEA_MARKETING_ANGLE}
- Đối tượng xem: {IDEA_TARGET_AUDIENCE}
- Nỗi đau / Vấn đề: {IDEA_PAIN_POINT}
- Thông điệp chính: {IDEA_KEY_MESSAGE}
- Hook gợi ý: {IDEA_HOOK}
- CTA gợi ý: {IDEA_CTA}
- Mô tả bối cảnh: {IDEA_DESCRIPTION}

[DỮ LIỆU NGHIÊN CỨU SẢN PHẨM (PRODUCT RESEARCH)]
{PRODUCT_RESEARCH_DATA}

==================================================
ĐỊNH DẠNG TRẢ VỀ (STRICT JSON ONLY):
==================================================
Trả về duy nhất một đối tượng JSON thuần túy (JSON object), KHÔNG chứa văn bản ngoài, KHÔNG dùng markdown.
Cấu trúc JSON:
{
  "title": "{IDEA_TITLE}",
  "duration": 35,
  "hook": "Câu hook mở đầu 1-3 giây",
  "scenes": [
    {
      "sceneNumber": 1,
      "startTime": 0,
      "endTime": 4,
      "duration": 4,
      "narration": "2.5 triệu cho một chiếc nồi chiên, liệu có thực sự đáng tiền?",
      "onScreenText": "2.5 TRIỆU CÓ ĐÁNG?",
      "visualDirection": "Show product hero shot with fast zoom and bold price tag",
      "mediaType": "product_image"
    }
  ],
  "cta": "Câu kêu gọi hành động ở góc cuối"
}
`.trim();

const VALID_MEDIA_TYPES: MediaType[] = [
  'product_image',
  'product_video',
  'stock_video',
  'stock_image',
  'ai_image',
  'text_only',
];

@Injectable()
export class ScriptEngineService {
  private readonly logger = new Logger(ScriptEngineService.name);

  constructor(
    private prisma: PrismaService,
    private llmService: LlmService,
    private queueService: QueueService,
  ) {}

  /**
   * Generates a VideoScript from a ContentIdea
   */
  async generateScriptFromIdea(contentIdeaId: string): Promise<VideoScriptResponse> {
    this.logger.log(`[ScriptEngine] Generating script for contentIdeaId=${contentIdeaId}`);

    const contentIdea = await this.prisma.contentIdea.findUnique({
      where: { id: contentIdeaId },
      include: { product: true },
    });

    if (!contentIdea) {
      throw new NotFoundException('Không tìm thấy ý tưởng nội dung');
    }

    const product = contentIdea.product;
    const { provider, apiKey, model } = await this.llmService.getActiveProviderConfig();

    let rawOutput: RawScriptLlmOutput | null = null;

    if (apiKey) {
      const researchData = this.buildResearchContext(product);
      const prompt = SCRIPT_ENGINE_PROMPT
        .replace(/{IDEA_TITLE}/g, contentIdea.title)
        .replace(/{IDEA_CONTENT_TYPE}/g, contentIdea.contentType)
        .replace(/{IDEA_MARKETING_ANGLE}/g, contentIdea.marketingAngle)
        .replace(/{IDEA_TARGET_AUDIENCE}/g, contentIdea.targetAudience)
        .replace(/{IDEA_PAIN_POINT}/g, contentIdea.painPoint)
        .replace(/{IDEA_KEY_MESSAGE}/g, contentIdea.keyMessage)
        .replace(/{IDEA_HOOK}/g, contentIdea.hook)
        .replace(/{IDEA_CTA}/g, contentIdea.recommendedCTA)
        .replace(/{IDEA_DESCRIPTION}/g, contentIdea.description)
        .replace('{PRODUCT_RESEARCH_DATA}', researchData);

      try {
        const responseText = await this.callLlm(provider, apiKey, model, prompt);
        rawOutput = this.parseAndValidateLlmOutput(responseText);
      } catch (err) {
        this.logger.warn(
          `[ScriptEngine] LLM API call failed (${err instanceof Error ? err.message : String(err)}). Using rule-based fallback generation.`,
        );
      }
    } else {
      this.logger.warn('[ScriptEngine] No LLM API key configured. Using rule-based fallback.');
    }

    if (!rawOutput) {
      rawOutput = this.buildFallbackScript(contentIdea, product);
    }

    // Process & normalize scenes and timings
    const normalizedScenes = this.normalizeAndValidateTiming(rawOutput.scenes, contentIdea);
    const totalDuration = normalizedScenes.reduce((sum, s) => sum + s.duration, 0);

    const title = rawOutput.title?.trim() || contentIdea.title;
    const hook = rawOutput.hook?.trim() || contentIdea.hook;
    const cta = rawOutput.cta?.trim() || contentIdea.recommendedCTA;

    // Save VideoScript in Database
    const savedScript = await this.prisma.videoScript.create({
      data: {
        productId: product.id,
        contentIdeaId: contentIdea.id,
        title,
        duration: totalDuration,
        language: 'vi',
        hook,
        scenes: normalizedScenes as any,
        cta,
        status: 'ready',
      },
    });

    // Update ContentIdea status to generated
    await this.prisma.contentIdea.update({
      where: { id: contentIdeaId },
      data: { status: 'generated' },
    });

    this.logger.log(`[ScriptEngine] Successfully generated VideoScript id=${savedScript.id}`);

    return this.mapToResponse(savedScript);
  }

  async getScriptsByContentIdea(contentIdeaId: string): Promise<VideoScriptResponse[]> {
    const scripts = await this.prisma.videoScript.findMany({
      where: { contentIdeaId },
      orderBy: { createdAt: 'desc' },
    });
    return scripts.map((s) => this.mapToResponse(s));
  }

  async getScriptsByProduct(productId: string): Promise<VideoScriptResponse[]> {
    const scripts = await this.prisma.videoScript.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });
    return scripts.map((s) => this.mapToResponse(s));
  }

  async getScriptById(id: string): Promise<VideoScriptResponse> {
    const script = await this.prisma.videoScript.findUnique({
      where: { id },
    });
    if (!script) {
      throw new NotFoundException('Không tìm thấy kịch bản video');
    }
    return this.mapToResponse(script);
  }

  /**
   * Adapter: Converts a VideoScript into legacy plain-text script format and enqueues video generation job.
   */
  async generateVideoFromScript(scriptId: string, config: VideoJobConfig = {}) {
    const script = await this.prisma.videoScript.findUnique({
      where: { id: scriptId },
      include: { product: true, contentIdea: true },
    });

    if (!script) {
      throw new NotFoundException('Không tìm thấy kịch bản video');
    }

    // Adapter: convert structured scenes into plain text narration
    const scenes = (script.scenes as unknown as ScriptScene[]) || [];
    const legacyScriptText = this.videoScriptToLegacyText(scenes, script.hook, script.cta);

    // Create Idea entity for full backward compatibility
    const idea = await this.prisma.idea.create({
      data: {
        title: script.title,
        topic: script.product.name,
        description: `Generated from Script Engine 2.0 (Script ID: ${script.id})`,
        script: legacyScriptText,
        language: script.language,
        status: 'ready',
        productId: script.productId,
      },
    });

    // Create GenerationJob record
    const job = await this.prisma.generationJob.create({
      data: {
        ideaId: idea.id,
        productId: script.productId,
        status: 'queued',
        config: config as any,
      },
    });

    // Queue job to BullMQ
    await this.queueService.addVideoJob(
      job.id,
      idea.id,
      script.title,
      legacyScriptText,
      script.language,
      {
        ...config,
        productId: script.productId,
      },
    );

    this.logger.log(
      `[ScriptEngine] Triggered legacy video generation job ${job.id} for script ${scriptId}`,
    );

    return {
      script: this.mapToResponse(script),
      job,
    };
  }

  /**
   * Converts array of scenes into plain narration string for legacy renderer
   */
  videoScriptToLegacyText(scenes: ScriptScene[], hook?: string, cta?: string): string {
    if (!scenes || scenes.length === 0) {
      return [hook, cta].filter(Boolean).join('\n\n');
    }
    return scenes.map((scene) => scene.narration.trim()).join('\n\n');
  }

  /**
   * Timing Validation & Normalization
   */
  normalizeAndValidateTiming(
    rawScenes: RawScriptLlmOutput['scenes'],
    contentIdea: any,
  ): ScriptScene[] {
    if (!rawScenes || !Array.isArray(rawScenes) || rawScenes.length === 0) {
      return this.buildFallbackScenes(contentIdea);
    }

    const result: ScriptScene[] = [];
    let currentStartTime = 0;

    for (let i = 0; i < rawScenes.length; i++) {
      const raw = rawScenes[i];
      const sceneNumber = i + 1;

      const narration = typeof raw.narration === 'string' && raw.narration.trim()
        ? raw.narration.trim()
        : `Cảnh ${sceneNumber}`;

      // Calculate reasonable duration based on word count (approx 3 words per sec, min 2s)
      const wordCount = narration.split(/\s+/).length;
      let calculatedDuration = Math.max(3, Math.round(wordCount / 2.8));

      if (raw.duration && typeof raw.duration === 'number' && raw.duration >= 1) {
        calculatedDuration = Math.round(raw.duration);
      }

      const startTime = currentStartTime;
      const endTime = startTime + calculatedDuration;
      currentStartTime = endTime;

      const onScreenText = typeof raw.onScreenText === 'string' && raw.onScreenText.trim()
        ? raw.onScreenText.trim()
        : this.deriveOnScreenText(narration);

      const visualDirection = typeof raw.visualDirection === 'string' && raw.visualDirection.trim()
        ? raw.visualDirection.trim()
        : `Visual direction for scene ${sceneNumber}`;

      const mediaType = this.normalizeMediaType(raw.mediaType, i);

      result.push({
        sceneNumber,
        startTime,
        endTime,
        duration: calculatedDuration,
        narration,
        onScreenText,
        visualDirection,
        mediaType,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Helper methods
  // ---------------------------------------------------------------------------

  private buildResearchContext(product: any): string {
    return `
Tên sản phẩm: ${product.name}
Thương hiệu: ${product.brand || 'N/A'}
Giá bán: ${product.price ? `${product.price} ${product.currency}` : 'N/A'}
Mô tả: ${product.description || 'N/A'}
Tính năng nổi bật: ${product.features?.join('; ') || 'N/A'}
Lợi ích sử dụng: ${product.benefits?.join('; ') || 'N/A'}
USP: ${product.usp?.join('; ') || 'N/A'}
Đối tượng: ${product.targetAudience || 'N/A'}
Nỗi đau: ${product.painPoints?.join('; ') || 'N/A'}
Trường hợp sử dụng: ${product.useCases?.join('; ') || 'N/A'}
Ưu điểm: ${product.pros?.join('; ') || 'N/A'}
Nhược điểm: ${product.cons?.join('; ') || 'N/A'}
`.trim();
  }

  private async callLlm(
    provider: string,
    apiKey: string,
    model: string,
    prompt: string,
  ): Promise<string> {
    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-3.6-flash'}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });
      if (!response.ok) {
        throw new Error(`Gemini API error ${response.status}: ${await response.text()}`);
      }
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    const openAiUrls: Record<string, string> = {
      groq: 'https://api.groq.com/openai/v1/chat/completions',
      openai: 'https://api.openai.com/v1/chat/completions',
      deepseek: 'https://api.deepseek.com/v1/chat/completions',
    };
    const url = openAiUrls[provider] || 'https://api.openai.com/v1/chat/completions';

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
      throw new Error(`${provider} API error ${response.status}: ${await response.text()}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  private parseAndValidateLlmOutput(rawText: string): RawScriptLlmOutput | null {
    if (!rawText || !rawText.trim()) return null;

    let cleaned = rawText.trim();
    cleaned = cleaned.replace(/```json/g, '').replace(/```/g, '').trim();

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    try {
      const parsed = JSON.parse(cleaned);
      if (typeof parsed === 'object' && parsed !== null && Array.isArray(parsed.scenes)) {
        return parsed as RawScriptLlmOutput;
      }
      return null;
    } catch (e) {
      this.logger.error(`[ScriptEngine] Failed to parse script JSON: ${e}`);
      return null;
    }
  }

  private normalizeMediaType(input?: string, sceneIndex: number = 0): MediaType {
    if (typeof input === 'string') {
      const lower = input.toLowerCase().trim() as MediaType;
      if (VALID_MEDIA_TYPES.includes(lower)) {
        return lower;
      }
    }
    // Default fallback: alternate between product_image and stock_video
    return sceneIndex % 2 === 0 ? 'product_image' : 'stock_video';
  }

  private deriveOnScreenText(narration: string): string {
    const words = narration.split(/\s+/);
    if (words.length <= 6) {
      return narration.toUpperCase();
    }
    return words.slice(0, 5).join(' ').toUpperCase() + '...';
  }

  private mapToResponse(script: any): VideoScriptResponse {
    return {
      id: script.id,
      productId: script.productId,
      contentIdeaId: script.contentIdeaId,
      title: script.title,
      duration: script.duration,
      language: script.language,
      hook: script.hook,
      scenes: (script.scenes as unknown as ScriptScene[]) || [],
      cta: script.cta,
      status: script.status,
      createdAt: script.createdAt,
      updatedAt: script.updatedAt,
    };
  }

  private buildFallbackScript(contentIdea: any, product: any): RawScriptLlmOutput {
    return {
      title: contentIdea.title,
      duration: 35,
      hook: contentIdea.hook,
      cta: contentIdea.recommendedCTA,
      scenes: this.buildFallbackScenes(contentIdea),
    };
  }

  private buildFallbackScenes(contentIdea: any): ScriptScene[] {
    const hookLine = contentIdea.hook || contentIdea.title;
    const ctaLine = contentIdea.recommendedCTA || 'Xem chi tiết ở link bên dưới!';
    const keyMsg = contentIdea.keyMessage || contentIdea.description;

    return [
      {
        sceneNumber: 1,
        startTime: 0,
        endTime: 4,
        duration: 4,
        narration: hookLine,
        onScreenText: hookLine.substring(0, 30).toUpperCase(),
        visualDirection: 'Show product hero image with fast zoom and attention grabbing title',
        mediaType: 'product_image',
      },
      {
        sceneNumber: 2,
        startTime: 4,
        endTime: 12,
        duration: 8,
        narration: `Nếu bạn đang gặp phải tình trạng ${contentIdea.painPoint || 'băn khoăn lựa chọn'}, đây chính là giải pháp dành cho bạn.`,
        onScreenText: 'GIẢI PHÁP TỐI ƯU',
        visualDirection: 'Show close-up details of product features in daily use',
        mediaType: 'product_video',
      },
      {
        sceneNumber: 3,
        startTime: 12,
        endTime: 22,
        duration: 10,
        narration: keyMsg,
        onScreenText: 'ĐIỂM NỔI BẬT',
        visualDirection: 'Show product value in action with smooth camera motion',
        mediaType: 'product_image',
      },
      {
        sceneNumber: 4,
        startTime: 22,
        endTime: 30,
        duration: 8,
        narration: ctaLine,
        onScreenText: 'XEM THÔNG TIN Ở LINK',
        visualDirection: 'Show product hero shot with price tag and clear Call-To-Action overlay',
        mediaType: 'product_image',
      },
    ];
  }
}
