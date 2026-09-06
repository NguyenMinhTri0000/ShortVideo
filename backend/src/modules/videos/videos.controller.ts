import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Res,
  Headers,
  StreamableFile,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { VideosService } from './videos.service';

@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get()
  findAll() {
    return this.videosService.findAll();
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadVideo(@UploadedFile() file: any, @Body('title') title?: string) {
    return this.videosService.uploadVideo(file, title);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.videosService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.videosService.remove(id);
  }

  @Post(':id/regenerate')
  regenerate(@Param('id') id: string) {
    return this.videosService.regenerate(id);
  }

  @Get(':id/stream')
  async stream(
    @Param('id') id: string,
    @Headers('range') range: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.videosService.getStream(id, range);
    if (file.contentType) {
      res.setHeader('Content-Type', file.contentType);
    }
    if (file.contentLength) {
      res.setHeader('Content-Length', String(file.contentLength));
    }
    res.setHeader('Accept-Ranges', 'bytes');
    if (file.contentRange) {
      res.setHeader('Content-Range', file.contentRange);
      res.status(206);
    }
    return new StreamableFile(file.stream);
  }

  @Get(':id/thumbnail')
  async thumbnail(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.videosService.getThumbnail(id);
    if (file.contentType) {
      res.setHeader('Content-Type', file.contentType);
    }
    if (file.contentLength) {
      res.setHeader('Content-Length', String(file.contentLength));
    }
    return new StreamableFile(file.stream);
  }

  @Get(':id/subtitle')
  async subtitle(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.videosService.getSubtitle(id);
    if (file.contentType) {
      res.setHeader('Content-Type', file.contentType);
    }
    if (file.contentLength) {
      res.setHeader('Content-Length', String(file.contentLength));
    }
    return new StreamableFile(file.stream);
  }
}
