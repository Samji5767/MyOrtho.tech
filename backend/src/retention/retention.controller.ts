import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RetentionService } from './retention.service';
import type { AuthenticatedRequest } from '../common/auth-request.type';

@Controller()
@UseGuards(AuthGuard)
export class RetentionController {
  constructor(private readonly svc: RetentionService) {}

  @Post('api/cases/:caseId/plans/:planId/retention/generate')
  generate(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.generateProtocol(caseId, req.user.orgId, req.user.id, planId);
  }

  @Get('api/cases/:caseId/plans/:planId/retention')
  getProtocol(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.getProtocol(caseId, req.user.orgId, planId);
  }

  @Get('api/cases/:caseId/plans/:planId/retention/wear-schedule')
  getWearSchedule(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.getWearSchedule(caseId, req.user.orgId, planId);
  }

  @Post('api/cases/:caseId/plans/:planId/retention/approve')
  approve(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.approveProtocol(caseId, req.user.orgId, req.user.id, planId);
  }
}
