import { Module } from '@nestjs/common';
import { ClinicalSafetyGateService } from './clinical-safety-gate.service';
import { ClinicalSafetyGateController } from './clinical-safety-gate.controller';

@Module({
  providers: [ClinicalSafetyGateService],
  controllers: [ClinicalSafetyGateController],
  exports: [ClinicalSafetyGateService],
})
export class ClinicalSafetyGateModule {}
