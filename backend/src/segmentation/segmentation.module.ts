import { Module } from '@nestjs/common';
import { SegmentationService } from './segmentation.service';
import { SegmentationController } from './segmentation.controller';
import { AutoCorrectionService } from './auto-correction.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [SegmentationService, AutoCorrectionService],
  controllers: [SegmentationController],
})
export class SegmentationModule {}
