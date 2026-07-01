import { Module } from '@nestjs/common';
import { ToothSegmentationController } from './tooth-segmentation.controller';
import { ToothSegmentationService } from './tooth-segmentation.service';

@Module({
  controllers: [ToothSegmentationController],
  providers: [ToothSegmentationService],
  exports: [ToothSegmentationService],
})
export class ToothSegmentationModule {}
