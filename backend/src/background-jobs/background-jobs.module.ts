import { Module } from '@nestjs/common';
import { BackgroundJobsService } from './background-jobs.service';
import { BackgroundJobsController } from './background-jobs.controller';

@Module({
  providers: [BackgroundJobsService],
  controllers: [BackgroundJobsController],
  exports: [BackgroundJobsService],
})
export class BackgroundJobsModule {}
