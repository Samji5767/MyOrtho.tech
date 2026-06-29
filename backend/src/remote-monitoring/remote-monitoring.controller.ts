import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { RemoteMonitoringService } from './remote-monitoring.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/cases/:caseId')
@UseGuards(AuthGuard)
export class RemoteMonitoringController {
  constructor(private readonly svc: RemoteMonitoringService) {}

  @Get('check-ins')
  list(@Req() req: Request, @Param('caseId') caseId: string) {
    return this.svc.listCheckIns(caseId, getUser(req).orgId);
  }

  @Post('check-ins')
  create(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() body: { checkInDate: string; wearHours?: number; painScore?: number; issuesReported?: string[]; photoUrls?: string[]; alignerStage?: number },
  ) {
    return this.svc.createCheckIn(caseId, getUser(req).orgId, body);
  }

  @Get('compliance-summary')
  summary(@Req() req: Request, @Param('caseId') caseId: string) {
    return this.svc.getComplianceSummary(caseId, getUser(req).orgId);
  }

  @Patch('check-ins/:checkInId/review')
  review(
    @Req() req: Request,
    @Param('checkInId') checkInId: string,
    @Body() body: { clinicianNotes: string },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.reviewCheckIn(checkInId, orgId, id, body.clinicianNotes);
  }
}
