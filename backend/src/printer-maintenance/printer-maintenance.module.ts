import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrinterMaintenanceService } from './printer-maintenance.service';
import { PrinterMaintenanceController } from './printer-maintenance.controller';

@Module({
  imports: [AuthModule],
  controllers: [PrinterMaintenanceController],
  providers: [PrinterMaintenanceService],
  exports: [PrinterMaintenanceService],
})
export class PrinterMaintenanceModule {}
