import { Module } from '@nestjs/common';
import { AiGovernanceController } from './ai-governance.controller';
import { AiGovernanceService } from './ai-governance.service';

@Module({
  controllers: [AiGovernanceController],
  providers: [AiGovernanceService],
})
export class AiGovernanceModule {}
