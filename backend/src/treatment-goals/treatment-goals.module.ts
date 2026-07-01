import { Module } from '@nestjs/common';
import { TreatmentGoalsController } from './treatment-goals.controller';
import { TreatmentGoalsService } from './treatment-goals.service';

@Module({
  controllers: [TreatmentGoalsController],
  providers: [TreatmentGoalsService],
  exports: [TreatmentGoalsService],
})
export class TreatmentGoalsModule {}
