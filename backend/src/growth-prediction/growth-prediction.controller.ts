import { Controller, Get, Post, Body, Param, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { GrowthPredictionService } from './growth-prediction.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/patients/:patientId/growth-predictions')
@UseGuards(AuthGuard)
export class GrowthPredictionController {
  constructor(private readonly svc: GrowthPredictionService) {}

  @Get()
  list(@Req() req: Request, @Param('patientId') patientId: string) {
    return this.svc.list(patientId, getUser(req).orgId);
  }

  @Post()
  create(
    @Req() req: Request,
    @Param('patientId') patientId: string,
    @Body() body: { predictionDate: string; skeletalAgeYears?: number; cervicalMaturationStage?: string; growthPotential?: string; mandibularGrowthRemainingMm?: number; predictedAdultClass?: string; recommendations?: string },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.create(orgId, id, { ...body, patientId });
  }
}
