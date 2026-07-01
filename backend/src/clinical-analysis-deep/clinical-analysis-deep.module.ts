import { Module } from '@nestjs/common';
import { ClinicalAnalysisDeepController } from './clinical-analysis-deep.controller';
import { ClinicalAnalysisDeepService } from './clinical-analysis-deep.service';

@Module({
  controllers: [ClinicalAnalysisDeepController],
  providers: [ClinicalAnalysisDeepService],
  exports: [ClinicalAnalysisDeepService],
})
export class ClinicalAnalysisDeepModule {}
