import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AnalyticsService } from './analytics.service';

interface AuthUser { id: string; email: string; orgId: string | null }

@Controller('api/analytics')
@UseGuards(AuthGuard)
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}

  @Get('summary')
  summary(@Req() req: Request) {
    const user = (req as Request & { user?: AuthUser }).user;
    const orgId = user?.orgId ?? '';
    return this.svc.getSummary(orgId);
  }
}
