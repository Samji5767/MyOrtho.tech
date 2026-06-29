import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SystemStatusService } from './system-status.service';
import { SystemStatusController } from './system-status.controller';

@Module({
  imports: [AuthModule],
  controllers: [SystemStatusController],
  providers: [SystemStatusService],
})
export class SystemStatusModule {}
