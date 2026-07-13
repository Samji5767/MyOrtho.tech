import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ManufacturingAnalyticsService } from './manufacturing-analytics.service';

interface AuthUser {
  id: string;
  email: string;
  orgId: string | null;
}

function getUser(req: Request): AuthUser {
  const user = (req as Request & { user?: AuthUser }).user;
  if (!user?.orgId) throw new UnauthorizedException('No organization context');
  return user;
}

@Controller('api/manufacturing/analytics')
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermission('manufacturing:read')
export class ManufacturingAnalyticsController {
  constructor(private readonly service: ManufacturingAnalyticsService) {}

  @Get()
  getMetrics(@Req() req: Request, @Query('days') daysParam?: string) {
    const user = getUser(req);
    const days = daysParam ? parseInt(daysParam, 10) : 30;
    return this.service.getMetrics(user.orgId!, isNaN(days) ? 30 : days);
  }
}
