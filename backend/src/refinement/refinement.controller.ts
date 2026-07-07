import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RefinementService, type CreateRefinementDto } from './refinement.service';
import type { AuthenticatedRequest } from '../common/auth-request.type';

@Controller('api/cases/:caseId/plans/:planId/refinement')
@UseGuards(AuthGuard)
export class RefinementController {
  constructor(private readonly svc: RefinementService) {}

  @Get()
  list(@Param('planId') planId: string, @Param('caseId') caseId: string, @Request() req: AuthenticatedRequest) {
    return this.svc.listCycles(planId, caseId, req.user.orgId as string);
  }

  @Post()
  create(
    @Param('planId') planId: string,
    @Param('caseId') caseId: string,
    @Body() dto: CreateRefinementDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.svc.createCycle(planId, caseId, req.user.orgId as string, dto, req.user.id as string);
  }

  @Patch(':cycleId/status')
  updateStatus(
    @Param('cycleId') cycleId: string,
    @Param('planId') planId: string,
    @Param('caseId') caseId: string,
    @Body() body: { status: 'pending' | 'planning' | 'stages_generated' | 'approved'; newStagesGenerated?: number },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.svc.updateCycleStatus(cycleId, planId, caseId, req.user.orgId as string, body.status, body.newStagesGenerated);
  }

  @Delete(':cycleId')
  remove(
    @Param('cycleId') cycleId: string,
    @Param('planId') planId: string,
    @Param('caseId') caseId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.svc.deleteCycle(cycleId, planId, caseId, req.user.orgId as string);
  }
}
