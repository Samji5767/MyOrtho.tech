import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClinicalReportsService } from './clinical-reports.service';
import { ClinicalReportsController } from './clinical-reports.controller';

@Module({
  imports: [AuthModule],
  controllers: [ClinicalReportsController],
  providers: [ClinicalReportsService],
  exports: [ClinicalReportsService],
})
export class ClinicalReportsModule {}
