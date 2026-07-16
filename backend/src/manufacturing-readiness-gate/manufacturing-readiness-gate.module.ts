import { Module } from '@nestjs/common';
import { ManufacturingReadinessGateService } from './manufacturing-readiness-gate.service';
import { ManufacturingReadinessGateController } from './manufacturing-readiness-gate.controller';

@Module({
  providers: [ManufacturingReadinessGateService],
  controllers: [ManufacturingReadinessGateController],
  exports: [ManufacturingReadinessGateService],
})
export class ManufacturingReadinessGateModule {}
