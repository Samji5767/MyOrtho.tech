import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PatientPortalService } from './patient-portal.service';
import { PatientPortalController } from './patient-portal.controller';

@Module({
  imports: [AuthModule],
  controllers: [PatientPortalController],
  providers: [PatientPortalService],
})
export class PatientPortalModule {}
