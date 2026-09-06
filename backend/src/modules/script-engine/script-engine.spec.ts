import { Test, TestingModule } from '@nestjs/testing';
import { ScriptEngineService } from './script-engine.service';
import { ScriptEngineController } from './script-engine.controller';
import { PrismaService } from '../database/prisma.service';
import { LlmService } from '../llm/llm.service';
import { QueueService } from '../queue/queue.service';
import { NotFoundException } from '@nestjs/common';
import { ScriptScene } from './types/script-engine.types';

describe('ScriptEngine 2.0', () => {
  let service: ScriptEngineService;
  let controller: ScriptEngineController;
  let prismaService: jest.Mocked<any>;
  let llmService: jest.Mocked<any>;
  let queueService: jest.Mocked<any>;

  const mockProduct = {
    id: 'prod-1',
    name: 'Nồi chiên không dầu Philips 6.2L',
    brand: 'Philips',
    price: '2500000',
    currency: 'VND',
    features: ['Dung tích 6.2L', 'Công nghệ Rapid Air'],
    benefits: ['Tiết kiệm thời gian', 'Giảm 90% dầu mỡ'],
    usp: ['Thương hiệu hàng đầu'],
    painPoints: ['Ngại ăn đồ nhiều mỡ'],
    targetAudience: 'Gia đình nhỏ',
  };

  const mockContentIdea = {
    id: 'idea-1',
    productId: 'prod-1',
    title: '2.5 triệu mua nồi Philips có đáng không?',
    contentType: 'value_for_money',
    marketingAngle: 'Phân tích giá trị sử dụng',
    targetAudience: 'Gia đình nhỏ',
    painPoint: 'Lo ngại chi phí cao',
    keyMessage: 'Hoàn toàn đáng giá với độ bền và tiện lợi',
    hook: '2.5 triệu cho một chiếc nồi chiên, có thực sự đáng tiền?',
    recommendedCTA: 'Xem ưu đãi ở link bên dưới.',
    description: 'Video review đánh giá thực tế chi phí bỏ ra',
    product: mockProduct,
  };

  const mockVideoScript = {
    id: 'script-1',
    productId: 'prod-1',
    contentIdeaId: 'idea-1',
    title: '2.5 triệu mua nồi Philips có đáng không?',
    duration: 35,
    language: 'vi',
    hook: '2.5 triệu cho một chiếc nồi chiên, có thực sự đáng tiền?',
    cta: 'Xem ưu đãi ở link bên dưới.',
    scenes: [
      {
        sceneNumber: 1,
        startTime: 0,
        endTime: 4,
        duration: 4,
        narration: '2.5 triệu cho một chiếc nồi chiên, có thực sự đáng tiền?',
        onScreenText: '2.5 TRIỆU CÓ ĐÁNG?',
        visualDirection: 'Show product hero shot',
        mediaType: 'product_image',
      },
      {
        sceneNumber: 2,
        startTime: 4,
        endTime: 14,
        duration: 10,
        narration:
          'Dung tích 6.2 lít với công nghệ Rapid Air giúp giảm 90% dầu mỡ.',
        onScreenText: '6.2L - GIẢM 90% DẦU MỠ',
        visualDirection: 'Show close up control panel',
        mediaType: 'product_video',
      },
    ],
    status: 'ready',
    createdAt: new Date(),
    updatedAt: new Date(),
    product: mockProduct,
    contentIdea: mockContentIdea,
  };

  beforeEach(async () => {
    prismaService = {
      contentIdea: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
      },
      videoScript: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      idea: {
        create: jest.fn(),
      },
      generationJob: {
        create: jest.fn(),
      },
    };

    llmService = {
      getActiveProviderConfig: jest.fn().mockResolvedValue({
        provider: 'gemini',
        apiKey: 'mock-key',
        model: 'gemini-2.0-flash',
      }),
    };

    queueService = {
      addVideoJob: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScriptEngineController],
      providers: [
        ScriptEngineService,
        { provide: PrismaService, useValue: prismaService },
        { provide: LlmService, useValue: llmService },
        { provide: QueueService, useValue: queueService },
      ],
    }).compile();

    service = module.get<ScriptEngineService>(ScriptEngineService);
    controller = module.get<ScriptEngineController>(ScriptEngineController);
  });

  describe('Timing Validation & Normalization', () => {
    it('should correctly normalize scene timestamps and ensure sequential non-overlapping timing', () => {
      const rawScenes = [
        {
          sceneNumber: 1,
          startTime: 0,
          endTime: 3,
          duration: 3,
          narration: 'Hook line for scene 1',
          onScreenText: 'HOOK LINE',
          visualDirection: 'Visual 1',
          mediaType: 'product_image',
        },
        {
          sceneNumber: 2,
          startTime: 3,
          endTime: 8,
          duration: 5,
          narration: 'Body narration for scene 2',
          onScreenText: 'BODY NARRATION',
          visualDirection: 'Visual 2',
          mediaType: 'stock_video',
        },
      ];

      const normalized = service.normalizeAndValidateTiming(
        rawScenes,
        mockContentIdea,
      );

      expect(normalized.length).toBe(2);
      expect(normalized[0].startTime).toBe(0);
      expect(normalized[0].endTime).toBe(3);
      expect(normalized[1].startTime).toBe(3);
      expect(normalized[1].endTime).toBe(8);
      expect(normalized[1].duration).toBe(5);
    });

    it('should generate fallback scenes if rawScenes are missing or empty', () => {
      const normalized = service.normalizeAndValidateTiming(
        [],
        mockContentIdea,
      );

      expect(normalized.length).toBeGreaterThan(0);
      expect(normalized[0].startTime).toBe(0);
      expect(normalized[0].narration).toContain(mockContentIdea.hook);
    });
  });

  describe('Legacy Video Renderer Adapter', () => {
    it('should concatenate scene narrations into plain text script format', () => {
      const scenes: ScriptScene[] = [
        {
          sceneNumber: 1,
          startTime: 0,
          endTime: 3,
          duration: 3,
          narration: 'Narration 1',
          onScreenText: 'TEXT 1',
          visualDirection: 'Vis 1',
          mediaType: 'product_image',
        },
        {
          sceneNumber: 2,
          startTime: 3,
          endTime: 8,
          duration: 5,
          narration: 'Narration 2',
          onScreenText: 'TEXT 2',
          visualDirection: 'Vis 2',
          mediaType: 'stock_video',
        },
      ];

      const legacyText = service.videoScriptToLegacyText(scenes);
      expect(legacyText).toBe('Narration 1\n\nNarration 2');
    });
  });

  describe('Script Generation & API Pipeline', () => {
    it('should generate a VideoScript from a valid ContentIdea', async () => {
      prismaService.contentIdea.findUnique.mockResolvedValue(mockContentIdea);
      prismaService.videoScript.create.mockResolvedValue(mockVideoScript);
      prismaService.contentIdea.update.mockResolvedValue({
        ...mockContentIdea,
        status: 'generated',
      });

      jest.spyOn(service as any, 'callLlm').mockResolvedValue(
        JSON.stringify({
          title: '2.5 triệu mua nồi Philips có đáng không?',
          duration: 35,
          hook: '2.5 triệu cho một chiếc nồi chiên, có thực sự đáng tiền?',
          scenes: mockVideoScript.scenes,
          cta: 'Xem ưu đãi ở link bên dưới.',
        }),
      );

      const result = await controller.generateScriptFromIdea('idea-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('script-1');
      expect(result.title).toBe('2.5 triệu mua nồi Philips có đáng không?');
      expect(prismaService.videoScript.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if ContentIdea does not exist', async () => {
      prismaService.contentIdea.findUnique.mockResolvedValue(null);
      await expect(
        service.generateScriptFromIdea('invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should trigger legacy video generation from VideoScript', async () => {
      prismaService.videoScript.findUnique.mockResolvedValue(mockVideoScript);
      prismaService.idea.create.mockResolvedValue({ id: 'legacy-idea-1' });
      prismaService.generationJob.create.mockResolvedValue({ id: 'job-1' });

      const res = await controller.generateVideoFromScript('script-1', {
        voice_name: 'vi-VN-Standard-A',
      });

      expect(res.job.id).toBe('job-1');
      expect(queueService.addVideoJob).toHaveBeenCalled();
    });
  });
});
