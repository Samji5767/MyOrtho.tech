import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RegulatoryComplianceService } from './regulatory-compliance.service';
import { RegulatoryComplianceController } from './regulatory-compliance.controller';

@Module({
  imports: [AuthModule],
  controllers: [RegulatoryComplianceController],
  providers: [RegulatoryComplianceService],
  exports: [RegulatoryComplianceService],
})
export class RegulatoryComplianceModule {}
