import { Module, Global } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BackgroundJobsModule } from '../background-jobs/background-jobs.module';
import { MlopsModule } from '../mlops/mlops.module';
import { ObservabilityService } from './observability.service';
import { ObservabilityController } from './observability.controller';
import { MetricsController } from './metrics.controller';

@Global()
@Module({
  imports: [AuthModule, BackgroundJobsModule, MlopsModule],
  controllers: [ObservabilityController, MetricsController],
  providers: [ObservabilityService],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
