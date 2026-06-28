import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AiProposalService, type GenerateProposalDto, type ReviewProposalDto } from './ai-proposal.service';

@Controller()
@UseGuards(AuthGuard)
export class AiProposalController {
  constructor(private readonly svc: AiProposalService) {}

  @Get('api/cases/:caseId/proposals')
  list(@Req() req: any, @Param('caseId') caseId: string) {
    return this.svc.list(caseId, req.user.organizationId);
  }

  @Post('api/cases/:caseId/proposals/generate')
  generate(@Req() req: any, @Param('caseId') caseId: string, @Body() dto: GenerateProposalDto) {
    return this.svc.generate(caseId, req.user.organizationId, req.user.sub, dto);
  }

  @Get('api/cases/:caseId/proposals/:proposalId')
  get(@Req() req: any, @Param('caseId') caseId: string, @Param('proposalId') proposalId: string) {
    return this.svc.get(caseId, req.user.organizationId, proposalId);
  }

  @Patch('api/cases/:caseId/proposals/:proposalId/review')
  review(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('proposalId') proposalId: string,
    @Body() dto: ReviewProposalDto,
  ) {
    return this.svc.review(caseId, req.user.organizationId, req.user.sub, proposalId, dto);
  }
}
