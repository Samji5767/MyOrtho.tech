import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DeviceTrackingService } from './device-tracking.service';
import { DeviceTrackingController } from './device-tracking.controller';

@Module({
  imports: [AuthModule],
  controllers: [DeviceTrackingController],
  providers: [DeviceTrackingService],
  exports: [DeviceTrackingService],
})
export class DeviceTrackingModule {}
