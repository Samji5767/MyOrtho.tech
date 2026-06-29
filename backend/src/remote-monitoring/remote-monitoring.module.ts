import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RemoteMonitoringService } from './remote-monitoring.service';
import { RemoteMonitoringController } from './remote-monitoring.controller';

@Module({
  imports: [AuthModule],
  controllers: [RemoteMonitoringController],
  providers: [RemoteMonitoringService],
  exports: [RemoteMonitoringService],
})
export class RemoteMonitoringModule {}
