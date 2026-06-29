import { Controller, Get, Post, Body, Param, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { OcclusionAnalysisService } from './occlusion-analysis.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/cases/:caseId/occlusion')
@UseGuards(AuthGuard)
export class OcclusionAnalysisController {
  constructor(private readonly svc: OcclusionAnalysisService) {}

  @Get()
  list(@Req() req: Request, @Param('caseId') caseId: string) {
    return this.svc.list(caseId, getUser(req).orgId);
  }

  @Post()
  create(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() body: { analysisDate: string; angleClass?: string; overjetMm?: number; overbitemm?: number; midlineShiftMm?: number; crossbiteTeeth?: number[]; openBiteTeeth?: number[]; crowdingUpperMm?: number; crowdingLowerMm?: number; tmjFindings?: string; notes?: string },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.create(caseId, orgId, id, body);
  }
}
