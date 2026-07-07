import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { AiScoresService } from './ai-scores.service';
import { DigitalTwinService } from './digital-twin.service';

@Module({
  imports: [AuthModule, AuditModule, WorkflowModule],
  controllers: [CasesController],
  providers: [CasesService, AiScoresService, DigitalTwinService],
  exports: [CasesService],
})
export class CasesModule {}
