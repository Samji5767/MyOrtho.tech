import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AnalysisService } from './analysis.service';
import { AnalysisController } from './analysis.controller';

@Module({
  imports: [AuthModule],
  providers: [AnalysisService],
  controllers: [AnalysisController],
  exports: [AnalysisService],
})
export class AnalysisModule {}
