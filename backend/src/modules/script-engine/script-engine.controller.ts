import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { ScriptEngineService } from './script-engine.service';
import { type VideoJobConfig } from '../queue/queue.service';

@Controller()
export class ScriptEngineController {
  constructor(private readonly scriptEngineService: ScriptEngineService) {}

  @Post('content-ideas/:id/generate-script')
  async generateScriptFromIdea(@Param('id') contentIdeaId: string) {
    return this.scriptEngineService.generateScriptFromIdea(contentIdeaId);
  }

  @Get('content-ideas/:id/scripts')
  async getScriptsByContentIdea(@Param('id') contentIdeaId: string) {
    return this.scriptEngineService.getScriptsByContentIdea(contentIdeaId);
  }

  @Get('products/:id/scripts')
  async getScriptsByProduct(@Param('id') productId: string) {
    return this.scriptEngineService.getScriptsByProduct(productId);
  }

  @Get('scripts/:id')
  async getScriptById(@Param('id') id: string) {
    return this.scriptEngineService.getScriptById(id);
  }

  @Post('scripts/:id/generate-video')
  async generateVideoFromScript(
    @Param('id') scriptId: string,
    @Body() config?: VideoJobConfig,
  ) {
    return this.scriptEngineService.generateVideoFromScript(
      scriptId,
      config || {},
    );
  }
}
