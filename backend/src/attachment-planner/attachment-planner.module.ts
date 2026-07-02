import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AttachmentPlannerController } from './attachment-planner.controller';
import { AttachmentPlannerService } from './attachment-planner.service';

@Module({
  imports: [AuthModule],
  controllers: [AttachmentPlannerController],
  providers: [AttachmentPlannerService],
  exports: [AttachmentPlannerService],
})
export class AttachmentPlannerModule {}
