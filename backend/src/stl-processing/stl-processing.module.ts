import { Module } from '@nestjs/common';
import { StlProcessingController } from './stl-processing.controller';
import { StlProcessingService } from './stl-processing.service';

@Module({
  controllers: [StlProcessingController],
  providers: [StlProcessingService],
  exports: [StlProcessingService],
})
export class StlProcessingModule {}
