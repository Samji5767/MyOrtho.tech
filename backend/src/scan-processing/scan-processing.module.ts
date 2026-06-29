import { Module } from '@nestjs/common';
import { ScanProcessingController } from './scan-processing.controller';
import { ScanProcessingService } from './scan-processing.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ScanProcessingController],
  providers: [ScanProcessingService],
  exports: [ScanProcessingService],
})
export class ScanProcessingModule {}
