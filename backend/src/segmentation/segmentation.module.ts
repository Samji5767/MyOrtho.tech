import { Module } from '@nestjs/common';
import { SegmentationService } from './segmentation.service';
import { SegmentationController } from './segmentation.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [SegmentationService],
  controllers: [SegmentationController],
})
export class SegmentationModule {}
