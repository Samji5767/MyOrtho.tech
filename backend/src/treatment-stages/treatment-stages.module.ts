import { Module } from '@nestjs/common';
import { TreatmentStagesController } from './treatment-stages.controller';
import { TreatmentStagesService } from './treatment-stages.service';

@Module({
  controllers: [TreatmentStagesController],
  providers: [TreatmentStagesService],
  exports: [TreatmentStagesService],
})
export class TreatmentStagesModule {}
