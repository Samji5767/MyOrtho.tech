import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { InsuranceService } from './insurance.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api')
@UseGuards(AuthGuard)
export class InsuranceController {
  constructor(private readonly svc: InsuranceService) {}

  @Get('patients/:patientId/insurance-plans')
  listPlans(@Req() req: Request, @Param('patientId') patientId: string) {
    return this.svc.listPlans(patientId, getUser(req).orgId);
  }

  @Post('patients/:patientId/insurance-plans')
  createPlan(
    @Req() req: Request,
    @Param('patientId') patientId: string,
    @Body() body: { payerName: string; planName?: string; memberId?: string; groupNumber?: string; isPrimary?: boolean; effectiveDate?: string; terminationDate?: string },
  ) {
    return this.svc.createPlan(getUser(req).orgId, patientId, body);
  }

  @Get('cases/:caseId/preauths')
  listPreAuths(@Req() req: Request, @Param('caseId') caseId: string) {
    return this.svc.listPreAuths(caseId, getUser(req).orgId);
  }

  @Post('cases/:caseId/preauths')
  createPreAuth(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() body: { insurancePlanId?: string; cdtCodes: string[]; notes?: string },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.createPreAuth(caseId, orgId, id, body);
  }

  @Post('preauths/:preAuthId/submit')
  submitPreAuth(@Req() req: Request, @Param('preAuthId') preAuthId: string) {
    return this.svc.submitPreAuth(preAuthId, getUser(req).orgId);
  }

  @Patch('preauths/:preAuthId/decision')
  updateDecision(
    @Req() req: Request,
    @Param('preAuthId') preAuthId: string,
    @Body() body: { status: 'approved' | 'denied'; authNumber?: string; approvedAmountCents?: number; notes?: string },
  ) {
    return this.svc.updateDecision(preAuthId, getUser(req).orgId, body);
  }
}
