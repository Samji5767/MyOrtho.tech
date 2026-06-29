import { Module } from '@nestjs/common';
import { TreatmentMonitoringController } from './treatment-monitoring.controller';
import { TreatmentMonitoringService } from './treatment-monitoring.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TreatmentMonitoringController],
  providers: [TreatmentMonitoringService],
  exports: [TreatmentMonitoringService],
})
export class TreatmentMonitoringModule {}
