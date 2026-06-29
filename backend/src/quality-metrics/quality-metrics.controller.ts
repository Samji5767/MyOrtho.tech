import { Controller, Get, Post, Body, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { QualityMetricsService } from './quality-metrics.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/quality-metrics')
@UseGuards(AuthGuard)
export class QualityMetricsController {
  constructor(private readonly svc: QualityMetricsService) {}

  @Get('standard')
  standard() { return this.svc.listStandardMetrics(); }

  @Get()
  list(@Req() req: Request, @Query('metric') metric?: string) {
    return this.svc.listMetrics(getUser(req).orgId, metric);
  }

  @Post()
  record(@Req() req: Request, @Body() body: { metricName: string; periodStart: string; periodEnd: string; targetValue?: number; actualValue?: number; unit?: string; notes?: string }) {
    return this.svc.recordMetric(getUser(req).orgId, body);
  }

  @Post('compute')
  compute(@Req() req: Request, @Body() body: { periodStart: string; periodEnd: string }) {
    return this.svc.computeMetrics(getUser(req).orgId, body.periodStart, body.periodEnd);
  }
}
