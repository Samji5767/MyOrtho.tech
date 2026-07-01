import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AnalysisService } from './analysis.service';
import { AnalysisController } from './analysis.controller';
import { BoltonService } from './bolton.service';

@Module({
  imports: [AuthModule],
  providers: [AnalysisService, BoltonService],
  controllers: [AnalysisController],
  exports: [AnalysisService, BoltonService],
})
export class AnalysisModule {}
