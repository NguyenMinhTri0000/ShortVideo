import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { QueueService, type VideoJobConfig } from '../queue/queue.service';

export type CreateProductDto = {
  name: string;
  description?: string;
  price?: string;
  currency?: string;
  affiliateUrl: string;
  features?: string[];
  benefits?: string[];
  targetAudience?: string;
  images?: string[];
};

export type UpdateProductDto = Partial<CreateProductDto>;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
  ) {}

  async create(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        currency: dto.currency || 'VND',
        affiliateUrl: dto.affiliateUrl,
        features: dto.features || [],
        benefits: dto.benefits || [],
        targetAudience: dto.targetAudience,
        images: dto.images || [],
      },
    });
  }

  async findAll() {
    return this.prisma.product.findMany({
      include: {
        _count: {
          select: { ideas: true, jobs: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        ideas: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        jobs: {
          orderBy: { createdAt: 'desc' },
          include: {
            videos: true,
          },
          take: 10,
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.affiliateUrl && { affiliateUrl: dto.affiliateUrl }),
        ...(dto.features && { features: dto.features }),
        ...(dto.benefits && { benefits: dto.benefits }),
        ...(dto.targetAudience !== undefined && { targetAudience: dto.targetAudience }),
        ...(dto.images && { images: dto.images }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.product.delete({
      where: { id },
    });
  }

  async generateVideo(id: string, config: VideoJobConfig = {}) {
    const product = await this.findOne(id);

    // Create Idea associated with product
    const idea = await this.prisma.idea.create({
      data: {
        title: product.name,
        topic: product.name,
        description: product.description || `Sản phẩm: ${product.name}`,
        language: 'vi',
        status: 'ready',
        productId: product.id,
      },
    });

    // Create GenerationJob associated with idea and product
    const job = await this.prisma.generationJob.create({
      data: {
        ideaId: idea.id,
        productId: product.id,
        status: 'queued',
        config,
      },
    });

    // Queue video generation job
    await this.queueService.addVideoJob(
      job.id,
      idea.id,
      product.name,
      undefined, // AI script will be generated with product context
      'vi',
      {
        ...config,
        productId: product.id,
      },
    );

    this.logger.log(`Created video generation job ${job.id} for product ${product.id}`);

    return {
      product,
      idea,
      job,
    };
  }
}
