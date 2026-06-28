import { Module } from '@nestjs/common';
import { AiProposalService } from './ai-proposal.service';
import { AiProposalController } from './ai-proposal.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [AiProposalService],
  controllers: [AiProposalController],
})
export class AiProposalModule {}
