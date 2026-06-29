import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClinicalDecisionSupportService } from './cds.service';
import { ClinicalDecisionSupportController } from './cds.controller';

@Module({
  imports: [AuthModule],
  controllers: [ClinicalDecisionSupportController],
  providers: [ClinicalDecisionSupportService],
  exports: [ClinicalDecisionSupportService],
})
export class ClinicalDecisionSupportModule {}
