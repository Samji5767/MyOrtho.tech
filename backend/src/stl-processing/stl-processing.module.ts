import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StlProcessingController } from './stl-processing.controller';
import { StlProcessingService } from './stl-processing.service';

@Module({
  imports: [AuthModule],
  controllers: [StlProcessingController],
  providers: [StlProcessingService],
  exports: [StlProcessingService],
})
export class StlProcessingModule {}
