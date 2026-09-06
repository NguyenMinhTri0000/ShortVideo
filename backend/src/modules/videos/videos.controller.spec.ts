import { Test, TestingModule } from '@nestjs/testing';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';

describe('VideosController', () => {
  let controller: VideosController;
  let service: VideosService;

  const mockVideo = {
    id: 'vid-1',
    title: 'Sample Video',
    videoObjectKey: 'uploads/sample.mp4',
    createdAt: new Date(),
  };

  const mockVideosService = {
    findAll: jest.fn().mockResolvedValue([mockVideo]),
    findOne: jest.fn().mockResolvedValue(mockVideo),
    uploadVideo: jest.fn().mockResolvedValue({
      ...mockVideo,
      id: 'vid-uploaded',
      title: 'Uploaded Title',
    }),
    remove: jest.fn().mockResolvedValue(mockVideo),
    regenerate: jest.fn().mockResolvedValue({ success: true }),
    getStream: jest.fn().mockResolvedValue({
      stream: {},
      contentType: 'video/mp4',
      contentLength: 1024,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VideosController],
      providers: [
        {
          provide: VideosService,
          useValue: mockVideosService,
        },
      ],
    }).compile();

    controller = module.get<VideosController>(VideosController);
    service = module.get<VideosService>(VideosService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all videos', async () => {
      const result = await controller.findAll();
      expect(result).toEqual([mockVideo]);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('uploadVideo', () => {
    it('should delegate upload to service', async () => {
      const fakeFile = {
        buffer: Buffer.from('test'),
        originalname: 'test.mp4',
      };
      const result = await controller.uploadVideo(fakeFile, 'Uploaded Title');
      expect(service.uploadVideo).toHaveBeenCalledWith(
        fakeFile,
        'Uploaded Title',
      );
      expect(result).toEqual({
        ...mockVideo,
        id: 'vid-uploaded',
        title: 'Uploaded Title',
      });
    });
  });

  describe('findOne', () => {
    it('should return a single video by id', async () => {
      const result = await controller.findOne('vid-1');
      expect(result).toEqual(mockVideo);
      expect(service.findOne).toHaveBeenCalledWith('vid-1');
    });
  });

  describe('remove', () => {
    it('should call service remove', async () => {
      const result = await controller.remove('vid-1');
      expect(service.remove).toHaveBeenCalledWith('vid-1');
      expect(result).toEqual(mockVideo);
    });
  });

  describe('regenerate', () => {
    it('should call service regenerate', async () => {
      const result = await controller.regenerate('vid-1');
      expect(service.regenerate).toHaveBeenCalledWith('vid-1');
      expect(result).toEqual({ success: true });
    });
  });
});
