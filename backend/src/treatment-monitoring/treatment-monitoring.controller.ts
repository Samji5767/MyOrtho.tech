import {
  Controller, Post, Get, Patch, Param, Body, Query, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { TreatmentMonitoringService, CheckInPayload } from './treatment-monitoring.service';

@Controller('api/cases/:caseId')
@UseGuards(AuthGuard)
export class TreatmentMonitoringController {
  constructor(private readonly svc: TreatmentMonitoringService) {}

  // ─── Check-ins ─────────────────────────────────────────────────────────────

  @Post('check-ins')
  submitCheckIn(
    @Param('caseId') caseId: string,
    @Req() req: any,
    @Body() body: CheckInPayload,
  ) {
    return this.svc.submitCheckIn(caseId, req.user.orgId, req.user.id, body);
  }

  @Get('check-ins')
  listCheckIns(
    @Param('caseId') caseId: string,
    @Req() req: any,
    @Query('planId') planId?: string,
  ) {
    return this.svc.listCheckIns(caseId, req.user.orgId, planId);
  }

  // ─── Alerts ────────────────────────────────────────────────────────────────

  @Get('off-track-alerts')
  listAlerts(
    @Param('caseId') caseId: string,
    @Req() req: any,
    @Query('planId') planId?: string,
  ) {
    return this.svc.listAlerts(caseId, req.user.orgId, planId);
  }

  @Patch('off-track-alerts/:alertId/resolve')
  resolveAlert(
    @Param('caseId') caseId: string,
    @Param('alertId') alertId: string,
    @Req() req: any,
    @Body() body: { status: 'reviewed' | 'resolved' | 'escalated'; note?: string },
  ) {
    return this.svc.resolveAlert(
      caseId, req.user.orgId, req.user.id, alertId, body.status, body.note,
    );
  }

  // ─── Quality Score ─────────────────────────────────────────────────────────

  @Post('plans/:planId/quality-score')
  computeQualityScore(
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Req() req: any,
  ) {
    return this.svc.computeQualityScore(caseId, req.user.orgId, req.user.id, planId);
  }

  @Get('plans/:planId/quality-score')
  getQualityScore(
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Req() req: any,
  ) {
    return this.svc.getQualityScore(caseId, req.user.orgId, planId);
  }
}
