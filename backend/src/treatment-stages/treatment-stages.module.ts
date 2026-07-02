import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TreatmentStagesController } from './treatment-stages.controller';
import { TreatmentStagesService } from './treatment-stages.service';

@Module({
  imports: [AuthModule],
  controllers: [TreatmentStagesController],
  providers: [TreatmentStagesService],
  exports: [TreatmentStagesService],
})
export class TreatmentStagesModule {}
