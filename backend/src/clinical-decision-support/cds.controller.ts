import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { ClinicalDecisionSupportService } from './cds.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/cds')
@UseGuards(AuthGuard)
export class ClinicalDecisionSupportController {
  constructor(private readonly svc: ClinicalDecisionSupportService) {}

  @Get('alerts')
  listAlerts(@Req() req: Request, @Query('caseId') caseId?: string, @Query('patientId') patientId?: string, @Query('unacknowledgedOnly') unacked?: string) {
    return this.svc.listAlerts(getUser(req).orgId, { caseId, patientId, unacknowledgedOnly: unacked === 'true' });
  }

  @Post('alerts')
  createAlert(@Req() req: Request, @Body() body: { caseId?: string; patientId?: string; alertType?: string; severity?: string; title: string; body: string }) {
    return this.svc.createAlert(getUser(req).orgId, body);
  }

  @Patch('alerts/:alertId/acknowledge')
  acknowledge(@Req() req: Request, @Param('alertId') alertId: string) {
    const { id, orgId } = getUser(req);
    return this.svc.acknowledgeAlert(alertId, orgId, id);
  }

  @Post('cases/:caseId/run-checks')
  runChecks(@Req() req: Request, @Param('caseId') caseId: string) {
    return this.svc.runChecks(caseId, getUser(req).orgId);
  }
}
