import { Module } from '@nestjs/common';
import { TreatmentPlansController } from './treatment-plans.controller';
import { TreatmentPlansService } from './treatment-plans.service';
import { ToothMovementsController, ClinicalMeasurementsController } from './tooth-movements.controller';
import { ToothMovementsService } from './tooth-movements.service';

@Module({
  controllers: [
    TreatmentPlansController,
    ToothMovementsController,
    ClinicalMeasurementsController,
  ],
  providers: [TreatmentPlansService, ToothMovementsService],
  exports: [TreatmentPlansService, ToothMovementsService],
})
export class TreatmentPlansModule {}
