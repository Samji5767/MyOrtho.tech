import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TreatmentGoalsController } from './treatment-goals.controller';
import { TreatmentGoalsService } from './treatment-goals.service';

@Module({
  imports: [AuthModule],
  controllers: [TreatmentGoalsController],
  providers: [TreatmentGoalsService],
  exports: [TreatmentGoalsService],
})
export class TreatmentGoalsModule {}
