import { Module } from '@nestjs/common';
import { BackgroundJobsService } from './background-jobs.service';
import { BackgroundJobsController } from './background-jobs.controller';
import { WorkerService } from './worker.service';
import { JobHandlerRegistry } from './job-handler.registry';

@Module({
  providers: [BackgroundJobsService, WorkerService, JobHandlerRegistry],
  controllers: [BackgroundJobsController],
  exports: [BackgroundJobsService, WorkerService, JobHandlerRegistry],
})
export class BackgroundJobsModule {}
