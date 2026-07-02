import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ToothSegmentationController } from './tooth-segmentation.controller';
import { ToothSegmentationService } from './tooth-segmentation.service';

@Module({
  imports: [AuthModule],
  controllers: [ToothSegmentationController],
  providers: [ToothSegmentationService],
  exports: [ToothSegmentationService],
})
export class ToothSegmentationModule {}
