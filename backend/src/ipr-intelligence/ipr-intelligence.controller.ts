import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { IprIntelligenceService } from './ipr-intelligence.service';

@Controller()
@UseGuards(AuthGuard)
export class IprIntelligenceController {
  constructor(private readonly svc: IprIntelligenceService) {}

  @Post('api/cases/:caseId/plans/:planId/ipr/optimize')
  optimize(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.optimizeIpr(caseId, req.user.orgId, req.user.id, planId);
  }

  @Get('api/cases/:caseId/plans/:planId/ipr/enamel-analysis')
  enamelAnalysis(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.getEnamelAnalysis(caseId, req.user.orgId, planId);
  }

  @Get('api/cases/:caseId/plans/:planId/ipr/clinical-warnings')
  clinicalWarnings(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.getClinicalWarnings(caseId, req.user.orgId, planId);
  }
}
