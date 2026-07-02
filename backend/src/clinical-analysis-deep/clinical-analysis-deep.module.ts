import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClinicalAnalysisDeepController } from './clinical-analysis-deep.controller';
import { ClinicalAnalysisDeepService } from './clinical-analysis-deep.service';

@Module({
  imports: [AuthModule],
  controllers: [ClinicalAnalysisDeepController],
  providers: [ClinicalAnalysisDeepService],
  exports: [ClinicalAnalysisDeepService],
})
export class ClinicalAnalysisDeepModule {}
