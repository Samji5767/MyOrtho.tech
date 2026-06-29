import { Controller, Get, Post, Body, Param, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { OutcomesService } from './outcomes.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api')
@UseGuards(AuthGuard)
export class OutcomesController {
  constructor(private readonly svc: OutcomesService) {}

  @Get('outcomes')
  listOrg(@Req() req: Request) {
    return this.svc.listOrgOutcomes(getUser(req).orgId);
  }

  @Get('outcomes/stats')
  stats(@Req() req: Request) {
    return this.svc.getOutcomeStats(getUser(req).orgId);
  }

  @Get('cases/:caseId/outcome')
  get(@Req() req: Request, @Param('caseId') caseId: string) {
    return this.svc.getOutcome(caseId, getUser(req).orgId);
  }

  @Post('cases/:caseId/outcome')
  record(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() body: {
      outcomeDate: string; finalOverjetMm?: number; finalOverbiteJm?: number;
      finalMidlineDeviationMm?: number; archCoordinationAchieved?: boolean;
      totalAlignersUsed?: number; refinementsCount?: number;
      treatmentDurationDays?: number; patientSatisfaction?: number;
      clinicianSatisfaction?: number; notes?: string;
    },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.recordOutcome(caseId, orgId, id, body);
  }
}
