import { Controller, Get, Post, Patch, Body, Param, ParseUUIDPipe, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { ClinicalReportsService } from './clinical-reports.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/cases/:caseId/reports')
@UseGuards(AuthGuard)
export class ClinicalReportsController {
  constructor(private readonly svc: ClinicalReportsService) {}

  @Get()
  list(@Req() req: Request, @Param('caseId') caseId: string) {
    const { orgId } = getUser(req);
    return this.svc.listReports(caseId, orgId);
  }

  @Post('treatment-summary')
  generateSummary(@Req() req: Request, @Param('caseId') caseId: string) {
    const { id, orgId } = getUser(req);
    return this.svc.generateTreatmentSummary(caseId, orgId, id);
  }

  @Post('aligner-progress')
  generateAlignerProgress(@Req() req: Request, @Param('caseId') caseId: string) {
    const { id, orgId } = getUser(req);
    return this.svc.generateAlignerProgressReport(caseId, orgId, id);
  }

  @Post('insurance-preauth')
  generatePreauth(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() body: { cdtCodes: string[]; estimatedFee: number; insurerId?: string },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.generateInsurancePreauth(caseId, orgId, id, body);
  }

  @Get(':reportId')
  getReport(@Req() req: Request, @Param('reportId', new ParseUUIDPipe()) reportId: string) {
    const { orgId } = getUser(req);
    return this.svc.getReport(reportId, orgId);
  }

  @Patch(':reportId/approve')
  approve(@Req() req: Request, @Param('reportId', new ParseUUIDPipe()) reportId: string) {
    const { id, orgId } = getUser(req);
    return this.svc.approveReport(reportId, orgId, id);
  }
}
