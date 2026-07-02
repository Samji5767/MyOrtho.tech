import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TreatmentQAController } from './treatment-qa.controller';
import { TreatmentQAService } from './treatment-qa.service';

@Module({
  imports: [AuthModule],
  controllers: [TreatmentQAController],
  providers: [TreatmentQAService],
  exports: [TreatmentQAService],
})
export class TreatmentQAModule {}
