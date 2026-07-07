import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { BiomechanicsService } from './biomechanics.service';
import type { AuthenticatedRequest } from '../common/auth-request.type';

interface AuthUser {
  id: string;
  email: string;
  role: string;
  name: string;
  orgId: string | null;
}

function getUser(req: ExpressRequest): AuthUser {
  const user = (req as ExpressRequest & { user?: AuthUser }).user;
  if (!user) throw new UnauthorizedException('No session');
  return user;
}

function requireOrgId(user: AuthUser): string {
  if (!user.orgId) throw new UnauthorizedException('Organization context required');
  return user.orgId;
}

// ── Phase 23 routes: /api/biomechanics/:setupId ─────────────────────────────
@Controller('api/biomechanics')
@UseGuards(AuthGuard)
export class BiomechanicsController {
  constructor(private readonly svc: BiomechanicsService) {}

  @Post(':setupId')
  analyze(@Req() req: ExpressRequest, @Param('setupId') setupId: string) {
    const user  = getUser(req);
    const orgId = requireOrgId(user);
    return this.svc.analyzeBiomechanics(orgId, setupId);
  }

  @Get(':setupId')
  getLatest(@Req() req: ExpressRequest, @Param('setupId') setupId: string) {
    const user  = getUser(req);
    const orgId = requireOrgId(user);
    return this.svc.getLatestAnalysis(orgId, setupId);
  }

  // ── Legacy routes: /api/cases/:caseId/plans/:planId/biomechanics ──────────
  // (These are mounted via separate controller path – kept here via NestJS
  //  path prefix on methods for backward compat with older clients)
}

// Legacy controller kept at original route
@Controller('api/cases/:caseId/plans/:planId/biomechanics')
@UseGuards(AuthGuard)
export class BiomechanicsLegacyController {
  constructor(private readonly svc: BiomechanicsService) {}

  @Get()
  getAssessment(
    @Param('planId') planId: string,
    @Param('caseId') caseId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.svc.getAssessment(planId, caseId, req.user.orgId as string);
  }

  @Post('assess')
  assessPlan(
    @Param('planId') planId: string,
    @Param('caseId') caseId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.svc.assessPlan(planId, caseId, req.user.orgId as string);
  }
}
