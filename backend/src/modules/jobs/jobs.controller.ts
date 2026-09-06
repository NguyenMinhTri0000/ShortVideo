import {
  Controller,
  Get,
  Post,
  Param,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { Observable, interval } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  findAll() {
    return this.jobsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  @Sse(':id/progress')
  streamProgress(@Param('id') id: string): Observable<MessageEvent> {
    return interval(2000).pipe(
      switchMap(async () => {
        const job = await this.jobsService.findOne(id);
        return {
          data: {
            id: job?.id,
            status: job?.status,
            progress: job?.progress,
            errorMessage: job?.errorMessage,
          },
        };
      }),
    );
  }

  @Get(':id/logs')
  getLogs(@Param('id') id: string) {
    return this.jobsService.getLogs(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.jobsService.cancel(id);
  }

  @Post(':id/retry')
  retry(@Param('id') id: string) {
    return this.jobsService.retry(id);
  }
}
