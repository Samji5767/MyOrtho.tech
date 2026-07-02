import { Body, Controller, Get, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PreexportQaService } from './preexport-qa.service';

interface AuthUser { id: string; orgId: string | null }

function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller()
@UseGuards(AuthGuard)
export class PreexportQaController {
  constructor(private readonly svc: PreexportQaService) {}

  @Get('api/cases/:caseId/preexport-qa')
  list(@Req() req: Request, @Param('caseId') caseId: string) {
    const { orgId } = getUser(req);
    return this.svc.list(caseId, orgId);
  }

  @Post('api/cases/:caseId/preexport-qa/run')
  run(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() dto: { treatmentPlanId?: string },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.runQA(caseId, orgId, id, dto);
  }

  @Post('api/cases/:caseId/preexport-qa/:reportId/approve')
  approve(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('reportId') reportId: string,
    @Body() dto: { notes?: string },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.approve(caseId, orgId, id, reportId, dto);
  }
}
