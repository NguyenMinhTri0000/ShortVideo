import { Test, TestingModule } from '@nestjs/testing';
import { ContentStrategyService } from './content-strategy.service';
import { ContentStrategyController } from './content-strategy.controller';
import { PrismaService } from '../database/prisma.service';
import { LlmService } from '../llm/llm.service';
import { QueueService } from '../queue/queue.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('ContentStrategyModule', () => {
  let service: ContentStrategyService;
  let controller: ContentStrategyController;
  let prisma: PrismaService;
  let llmService: LlmService;

  const mockProduct = {
    id: 'prod-test-123',
    name: 'Nồi chiên không dầu Philips HD9252',
    brand: 'Philips',
    category: 'Gia dụng bếp',
    description: 'Nồi chiên dung tích 4.1L công nghệ Rapid Air',
    price: '2.490.000',
    currency: 'VND',
    features: ['Công nghệ Rapid Air', 'Dung tích 4.1L', 'Màn hình cảm ứng'],
    benefits: ['Giảm 90% lượng chất béo', 'Tiết kiệm thời gian nấu nướng'],
    usp: ['Thương hiệu uy tín Philips', 'Chiên nướng chín đều không cần lật'],
    targetAudience: 'Gia đình nhỏ và người bận rộn',
    painPoints: ['Sợ ăn đồ nhiều dầu mỡ', 'Không có thời gian đứng bếp'],
    pros: ['Dễ vệ sinh', 'Nấu nhanh'],
    cons: ['Dung tích vừa phải cho 2-4 người'],
    contentBrief: {
      product: 'Nồi chiên không dầu Philips HD9252',
      targetAudience: 'Gia đình nhỏ',
      mainPainPoint: 'Lo ngại mỡ thừa',
      mainBenefit: 'Giảm 90% dầu mỡ',
      recommendedHook: '2.5 triệu cho một chiếc nồi chiên, có thực sự đáng?',
      recommendedCTA: 'Xem ưu đãi tại link bên dưới',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRawLlmResponse = JSON.stringify([
    {
      title: '2.5 triệu mua nồi Philips có đáng không?',
      description: 'Phân tích thực tế giá trị sử dụng so với chi phí bỏ ra.',
      contentType: 'value_for_money',
      marketingAngle: 'Đánh giá giá trị thực tế',
      targetAudience: 'Gia đình nhỏ và người đi làm',
      painPoint: 'Lo lắng chi số tiền lớn không hiệu quả',
      keyMessage: 'Nồi chiên bền bỉ, tiết kiệm thời gian đáng giá từng đồng',
      hook: '2.5 triệu cho một chiếc nồi chiên, có thực sự đáng tiền?',
      recommendedCTA: 'Xem giá và thông tin ở link bên dưới',
      priority: 1,
    },
    {
      title: '3 món ăn làm cực nhanh bằng nồi chiên Philips',
      description: 'Kịch bản thực tế 3 món ngon cho người bận rộn.',
      contentType: 'use_case',
      marketingAngle: 'Tiện lợi & Tiết kiệm thời gian',
      targetAudience: 'Người bận rộn',
      painPoint: 'Không có thời gian chuẩn bị bữa ăn',
      keyMessage: 'Bữa ăn nhanh gọn chuẩn vị chỉ với 15 phút',
      hook: 'Bận rộn nhưng vẫn muốn ăn ngon? Thử ngay 3 món này!',
      recommendedCTA: 'Lưu ngay video và mua ngay hôm nay',
      priority: 2,
    },
  ]);

  const mockPrismaService = {
    product: {
      findUnique: jest.fn().mockResolvedValue(mockProduct),
    },
    contentIdea: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockImplementation((args) =>
        Promise.resolve({
          id: `idea-${Math.random()}`,
          ...args.data,
          status: args.data.status || 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockImplementation((args) =>
        Promise.resolve({
          id: args.where.id,
          productId: mockProduct.id,
          product: mockProduct,
          title: '2.5 triệu mua nồi Philips có đáng không?',
          description: 'Phân tích thực tế giá trị sử dụng',
          contentType: 'value_for_money',
          marketingAngle: 'Đánh giá giá trị thực tế',
          targetAudience: 'Gia đình nhỏ',
          painPoint: 'Băn khoăn về giá',
          keyMessage: 'Xứng đáng đầu tư',
          hook: '2.5 triệu mua nồi chiên có đáng không?',
          recommendedCTA: 'Click link bên dưới',
          priority: 1,
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ),
      update: jest.fn().mockImplementation((args) =>
        Promise.resolve({
          id: args.where.id,
          ...args.data,
        }),
      ),
      delete: jest.fn().mockResolvedValue({ success: true }),
    },
    idea: {
      create: jest.fn().mockImplementation((args) =>
        Promise.resolve({
          id: `gen-idea-${Math.random()}`,
          ...args.data,
        }),
      ),
    },
    generationJob: {
      create: jest.fn().mockImplementation((args) =>
        Promise.resolve({
          id: `job-${Math.random()}`,
          ...args.data,
        }),
      ),
    },
  };

  const mockLlmService = {
    getActiveProviderConfig: jest.fn().mockResolvedValue({
      provider: 'openai',
      apiKey: 'test-api-key',
      model: 'gpt-4o-mini',
    }),
  };

  const mockQueueService = {
    addVideoJob: jest.fn().mockResolvedValue({ id: 'job-123' }),
  };

  const mockStrategyQueue = {
    add: jest.fn().mockResolvedValue({ id: 'strategy-job-1' }),
  };

  beforeEach(async () => {
    // Global fetch mock
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{ message: { content: mockRawLlmResponse } }],
      }),
    } as any);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContentStrategyController],
      providers: [
        ContentStrategyService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LlmService, useValue: mockLlmService },
        { provide: QueueService, useValue: mockQueueService },
        { provide: getQueueToken('content-strategy'), useValue: mockStrategyQueue },
      ],
    }).compile();

    service = module.get<ContentStrategyService>(ContentStrategyService);
    controller = module.get<ContentStrategyController>(ContentStrategyController);
    prisma = module.get<PrismaService>(PrismaService);
    llmService = module.get<LlmService>(LlmService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1. should be defined', () => {
    expect(service).toBeDefined();
    expect(controller).toBeDefined();
  });

  it('2. ContentStrategyService: should generate content ideas from product research data', async () => {
    const result = await service.generateContentIdeas(mockProduct.id);

    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(result.ideas[0].title).toBe('2.5 triệu mua nồi Philips có đáng không?');
    expect(result.ideas[0].contentType).toBe('value_for_money');
    expect(result.ideas[0].hook).toContain('2.5 triệu');
    expect(mockPrismaService.contentIdea.create).toHaveBeenCalledTimes(2);
  });

  it('3. AI structured JSON validation: should validate and clean LLM JSON response', () => {
    const serviceAny = service as any;

    const validJson = mockRawLlmResponse;
    const parsed = serviceAny.parseAndValidateResponse(validJson);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].contentType).toBe('value_for_money');

    // Test with markdown code blocks wrapped json
    const markdownWrapped = `\`\`\`json\n${mockRawLlmResponse}\n\`\`\``;
    const parsedWrapped = serviceAny.parseAndValidateResponse(markdownWrapped);
    expect(parsedWrapped).toHaveLength(2);

    // Test with invalid JSON fallback
    const invalidJson = 'Not a json response';
    const parsedInvalid = serviceAny.parseAndValidateResponse(invalidJson);
    expect(parsedInvalid).toEqual([]);
  });

  it('4. Product -> Content Ideas: controller endpoint POST /products/:id/content-ideas/generate', async () => {
    const res = await controller.generateContentIdeas(mockProduct.id);
    expect(res.success).toBe(true);
    expect(res.ideas.length).toBeGreaterThan(0);
  });

  it('5. API Endpoints: GET content ideas, GET idea detail, DELETE content idea', async () => {
    mockPrismaService.contentIdea.findMany.mockResolvedValueOnce([
      {
        id: 'idea-1',
        productId: mockProduct.id,
        title: 'Idea 1',
        description: 'Desc 1',
        contentType: 'product_review',
        marketingAngle: 'Angle 1',
        targetAudience: 'Target 1',
        painPoint: 'Pain 1',
        keyMessage: 'Msg 1',
        hook: 'Hook 1',
        recommendedCTA: 'CTA 1',
        priority: 1,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const listRes = await controller.getContentIdeasByProduct(mockProduct.id);
    expect(listRes).toHaveLength(1);
    expect(listRes[0].title).toBe('Idea 1');

    const detailRes = await controller.getContentIdeaById('idea-1');
    expect(detailRes).toBeDefined();

    const deleteRes = await controller.deleteContentIdea('idea-1');
    expect(deleteRes.success).toBe(true);
  });

  it('6. Integration Test: Product -> Content Ideas -> Select Idea -> Trigger Video Generator', async () => {
    // Step A: Researched Product exists
    expect(mockProduct.id).toBe('prod-test-123');

    // Step B: Generate Content Ideas
    const genResult = await service.generateContentIdeas(mockProduct.id);
    expect(genResult.ideas.length).toBe(2);

    const selectedIdeaId = genResult.ideas[0].id;

    // Step C: Trigger Video Generation from selected idea
    const videoResult = await controller.generateVideoFromIdea(selectedIdeaId, {
      aspect_ratio: '9:16',
      voice_name: 'vi-VN-Standard-A',
    });

    expect(videoResult.idea).toBeDefined();
    expect(videoResult.job).toBeDefined();
    expect(mockQueueService.addVideoJob).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      '2.5 triệu mua nồi Philips có đáng không?',
      undefined,
      'vi',
      expect.objectContaining({
        aspect_ratio: '9:16',
        productId: mockProduct.id,
      }),
    );
  });
});
