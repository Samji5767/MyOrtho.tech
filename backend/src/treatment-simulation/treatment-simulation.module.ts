import { Module } from '@nestjs/common';
import { TreatmentSimulationService } from './treatment-simulation.service';
import { TreatmentSimulationController } from './treatment-simulation.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [TreatmentSimulationService],
  controllers: [TreatmentSimulationController],
})
export class TreatmentSimulationModule {}
