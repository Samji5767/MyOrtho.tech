import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { TreatmentPlansController } from './treatment-plans.controller';
import { TreatmentPlansService } from './treatment-plans.service';
import { ToothMovementsController, ClinicalMeasurementsController } from './tooth-movements.controller';
import { ToothMovementsService } from './tooth-movements.service';
import { IprController, AttachmentsController } from './plan-features.controller';
import { PlanFeaturesService } from './plan-features.service';

@Module({
  imports: [AuthModule, WorkflowModule],
  controllers: [
    TreatmentPlansController,
    ToothMovementsController,
    ClinicalMeasurementsController,
    IprController,
    AttachmentsController,
  ],
  providers: [TreatmentPlansService, ToothMovementsService, PlanFeaturesService],
  exports: [TreatmentPlansService, ToothMovementsService],
})
export class TreatmentPlansModule {}
