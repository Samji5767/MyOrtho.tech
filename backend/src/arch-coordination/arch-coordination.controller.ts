import { Controller, Get, Post, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ArchCoordinationService, CoordinatePlanDto } from './arch-coordination.service';
import type { AuthenticatedRequest } from '../common/auth-request.type';

@Controller()
@UseGuards(AuthGuard)
export class ArchCoordinationController {
  constructor(private readonly svc: ArchCoordinationService) {}

  @Post('api/cases/:caseId/plans/:planId/arch-coordination/coordinate')
  coordinate(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Body() dto: CoordinatePlanDto,
  ) {
    return this.svc.coordinatePlan(caseId, req.user.orgId, req.user.id, planId, dto);
  }

  @Get('api/cases/:caseId/plans/:planId/arch-coordination')
  getPlan(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.getCoordinationPlan(caseId, req.user.orgId, planId);
  }

  @Get('api/cases/:caseId/plans/:planId/arch-coordination/checkpoints')
  getCheckpoints(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.getCheckpoints(caseId, req.user.orgId, planId);
  }

  @Patch('api/cases/:caseId/plans/:planId/arch-coordination/checkpoints/:checkpointId/evaluate')
  evaluateCheckpoint(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Param('checkpointId') checkpointId: string,
    @Body('status') status: 'passed' | 'failed' | 'deferred',
    @Body('clinicalNote') clinicalNote?: string,
  ) {
    return this.svc.evaluateCheckpoint(caseId, req.user.orgId, planId, checkpointId, status, clinicalNote);
  }

  @Get('api/cases/:caseId/plans/:planId/arch-coordination/sync-allocations')
  getSyncAllocations(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Query('arch') arch?: 'upper' | 'lower',
  ) {
    return this.svc.getSyncAllocations(caseId, req.user.orgId, planId, arch);
  }

  @Post('api/cases/:caseId/plans/:planId/arch-coordination/approve')
  approve(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.approvePlan(caseId, req.user.orgId, req.user.id, planId);
  }
}
