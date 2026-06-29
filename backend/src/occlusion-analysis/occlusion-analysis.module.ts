import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OcclusionAnalysisService } from './occlusion-analysis.service';
import { OcclusionAnalysisController } from './occlusion-analysis.controller';

@Module({
  imports: [AuthModule],
  controllers: [OcclusionAnalysisController],
  providers: [OcclusionAnalysisService],
  exports: [OcclusionAnalysisService],
})
export class OcclusionAnalysisModule {}
