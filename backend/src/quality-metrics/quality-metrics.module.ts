import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QualityMetricsService } from './quality-metrics.service';
import { QualityMetricsController } from './quality-metrics.controller';

@Module({
  imports: [AuthModule],
  controllers: [QualityMetricsController],
  providers: [QualityMetricsService],
  exports: [QualityMetricsService],
})
export class QualityMetricsModule {}
