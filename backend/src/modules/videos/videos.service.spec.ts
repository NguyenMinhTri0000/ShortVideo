import { Test, TestingModule } from '@nestjs/testing';
import { VideosService } from './videos.service';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { JobsService } from '../jobs/jobs.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('VideosService', () => {
  let service: VideosService;
  let prisma: any;
  let storage: any;
  let jobsService: any;

  const mockVideo = {
    id: 'vid-1',
    title: 'Test Video',
    videoObjectKey: 'videos/test.mp4',
    thumbnailObjectKey: 'thumbnails/test.jpg',
    subtitleObjectKey: 'subtitles/test.vtt',
    metadataObjectKey: null,
    ratio: '9:16',
    jobId: 'job-1',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      video: {
        findMany: jest.fn().mockResolvedValue([mockVideo]),
        findUnique: jest.fn().mockResolvedValue(mockVideo),
        create: jest
          .fn()
          .mockImplementation((args) =>
            Promise.resolve({ id: 'vid-2', ...args.data }),
          ),
        delete: jest.fn().mockResolvedValue(mockVideo),
      },
    };

    storage = {
      uploadBuffer: jest.fn().mockResolvedValue('uploads/videos/123.mp4'),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      getFileStream: jest.fn().mockResolvedValue({
        stream: {},
        contentType: 'video/mp4',
      }),
    };

    jobsService = {
      retry: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideosService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: JobsService, useValue: jobsService },
      ],
    }).compile();

    service = module.get<VideosService>(VideosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of videos', async () => {
      const result = await service.findAll();
      expect(result).toEqual([mockVideo]);
      expect(prisma.video.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single video by id', async () => {
      const result = await service.findOne('vid-1');
      expect(result).toEqual(mockVideo);
      expect(prisma.video.findUnique).toHaveBeenCalledWith({
        where: { id: 'vid-1' },
        include: { idea: true, job: true },
      });
    });

    it('should throw NotFoundException if video does not exist', async () => {
      prisma.video.findUnique.mockResolvedValueOnce(null);
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('uploadVideo', () => {
    it('should upload video buffer to storage and save video record in database', async () => {
      const fakeFile = {
        buffer: Buffer.from('fake video content'),
        originalname: 'custom-video.mp4',
        mimetype: 'video/mp4',
      };

      const result = await service.uploadVideo(fakeFile, 'Custom Title');
      expect(storage.uploadBuffer).toHaveBeenCalled();
      expect(prisma.video.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Custom Title',
          ratio: '9:16',
        }),
      });
      expect(result.id).toBe('vid-2');
    });

    it('should throw BadRequestException if no file buffer is provided', async () => {
      await expect(
        service.uploadVideo({ buffer: null as any }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete storage files and database record', async () => {
      const result = await service.remove('vid-1');
      expect(storage.deleteFile).toHaveBeenCalledWith('videos/test.mp4');
      expect(storage.deleteFile).toHaveBeenCalledWith('thumbnails/test.jpg');
      expect(prisma.video.delete).toHaveBeenCalledWith({
        where: { id: 'vid-1' },
      });
      expect(result).toEqual(mockVideo);
    });
  });

  describe('regenerate', () => {
    it('should call jobsService.retry if video has jobId', async () => {
      const result = await service.regenerate('vid-1');
      expect(jobsService.retry).toHaveBeenCalledWith('job-1');
      expect(result).toEqual({ success: true });
    });

    it('should throw BadRequestException if video does not have jobId', async () => {
      prisma.video.findUnique.mockResolvedValueOnce({
        ...mockVideo,
        jobId: null,
      });
      await expect(service.regenerate('vid-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
