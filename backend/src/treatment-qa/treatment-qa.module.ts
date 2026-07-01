import { Module } from '@nestjs/common';
import { TreatmentQAController } from './treatment-qa.controller';
import { TreatmentQAService } from './treatment-qa.service';

@Module({
  controllers: [TreatmentQAController],
  providers: [TreatmentQAService],
  exports: [TreatmentQAService],
})
export class TreatmentQAModule {}
