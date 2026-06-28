import { Module } from '@nestjs/common';
import { AttachmentPlannerController } from './attachment-planner.controller';
import { AttachmentPlannerService } from './attachment-planner.service';

@Module({
  controllers: [AttachmentPlannerController],
  providers: [AttachmentPlannerService],
  exports: [AttachmentPlannerService],
})
export class AttachmentPlannerModule {}
