import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { TreatmentSimulationService } from './treatment-simulation.service';
import type { AuthenticatedRequest } from '../common/auth-request.type';

@Controller()
@UseGuards(AuthGuard)
export class TreatmentSimulationController {
  constructor(private readonly svc: TreatmentSimulationService) {}

  @Post('api/cases/:caseId/plans/:planId/simulation/generate')
  generate(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.generateSimulation(caseId, req.user.orgId, req.user.id, planId);
  }

  @Get('api/cases/:caseId/plans/:planId/simulation')
  getSimulation(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.getSimulation(caseId, req.user.orgId, planId);
  }

  @Get('api/cases/:caseId/plans/:planId/simulation/frames/:stageNum')
  getFrame(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Param('stageNum') stageNum: string,
  ) {
    return this.svc.getFrame(caseId, req.user.orgId, planId, parseInt(stageNum, 10));
  }

  @Get('api/cases/:caseId/plans/:planId/simulation/arch-coordination')
  archCoordination(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.getArchCoordination(caseId, req.user.orgId, planId);
  }
}
