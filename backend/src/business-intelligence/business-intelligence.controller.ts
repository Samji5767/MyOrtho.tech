import { Controller, Get, Post, Body, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { BusinessIntelligenceService } from './business-intelligence.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/bi')
@UseGuards(AuthGuard)
export class BusinessIntelligenceController {
  constructor(private readonly svc: BusinessIntelligenceService) {}

  @Get('dashboard')
  dashboard(@Req() req: Request) {
    return this.svc.getDashboardMetrics(getUser(req).orgId);
  }

  @Get('case-trend')
  caseTrend(@Req() req: Request, @Query('days') days?: string) {
    return this.svc.getCaseTrend(getUser(req).orgId, days ? Number(days) : 90);
  }

  @Get('metrics')
  historical(@Req() req: Request, @Query('metric') metric: string, @Query('days') days?: string) {
    return this.svc.getHistoricalMetric(getUser(req).orgId, metric, days ? Number(days) : 90);
  }

  @Post('snapshots')
  snapshot(
    @Req() req: Request,
    @Body() body: { metricName: string; metricValue: number; snapshotDate?: string; dimensions?: Record<string, unknown> },
  ) {
    return this.svc.recordSnapshot(getUser(req).orgId, body);
  }
}
