import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AiProposalService, type GenerateProposalDto, type ReviewProposalDto } from './ai-proposal.service';

function getUser(req: Request): { id: string; orgId: string } {
  const user = (req as Request & { user?: { id: string; orgId: string } }).user;
  if (!user?.orgId) throw new UnauthorizedException('Authentication required');
  return { id: user.id, orgId: user.orgId };
}

@Controller()
@UseGuards(AuthGuard)
export class AiProposalController {
  constructor(private readonly svc: AiProposalService) {}

  @Get('api/cases/:caseId/proposals')
  list(@Req() req: Request, @Param('caseId') caseId: string) {
    return this.svc.list(caseId, getUser(req).orgId);
  }

  @Post('api/cases/:caseId/proposals/generate')
  generate(@Req() req: Request, @Param('caseId') caseId: string, @Body() dto: GenerateProposalDto) {
    const { id, orgId } = getUser(req);
    return this.svc.generate(caseId, orgId, id, dto);
  }

  @Get('api/cases/:caseId/proposals/:proposalId')
  get(@Req() req: Request, @Param('caseId') caseId: string, @Param('proposalId', new ParseUUIDPipe()) proposalId: string) {
    return this.svc.get(caseId, getUser(req).orgId, proposalId);
  }

  @Patch('api/cases/:caseId/proposals/:proposalId/review')
  review(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('proposalId', new ParseUUIDPipe()) proposalId: string,
    @Body() dto: ReviewProposalDto,
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.review(caseId, orgId, id, proposalId, dto);
  }
}
