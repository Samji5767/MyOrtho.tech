import { Module } from '@nestjs/common';
import { AiOrchestratorService } from './ai-orchestrator.service';

@Module({
  providers: [AiOrchestratorService],
  exports: [AiOrchestratorService],
})
export class AiModule {}
