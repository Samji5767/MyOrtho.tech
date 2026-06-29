import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlatformHealthService } from './platform-health.service';
import { PlatformHealthController } from './platform-health.controller';

@Module({
  imports: [AuthModule],
  controllers: [PlatformHealthController],
  providers: [PlatformHealthService],
  exports: [PlatformHealthService],
})
export class PlatformHealthModule {}
