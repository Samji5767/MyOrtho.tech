import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PatientEducationService } from './patient-education.service';
import { PatientEducationController } from './patient-education.controller';

@Module({
  imports: [AuthModule],
  controllers: [PatientEducationController],
  providers: [PatientEducationService],
  exports: [PatientEducationService],
})
export class PatientEducationModule {}
