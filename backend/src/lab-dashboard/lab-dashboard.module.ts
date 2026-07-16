import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { LabDashboardService } from './lab-dashboard.service';
import { LabDashboardController } from './lab-dashboard.controller';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [LabDashboardController],
  providers: [LabDashboardService],
  exports: [LabDashboardService],
})
export class LabDashboardModule {}
