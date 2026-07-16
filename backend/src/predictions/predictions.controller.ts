import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PredictionsService } from './predictions.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';

interface AuthUser { id: string; email: string; role: string; orgId: string | null }
function getUser(req: Request): AuthUser {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u) throw new UnauthorizedException();
  return u;
}

@Controller('api/predictions')
@UseGuards(AuthGuard, PermissionsGuard)
export class PredictionsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  @Get('cases/:id')
  @RequirePermission('cases:read')
  async getCasePredictions(@Req() req: Request, @Param('id') id: string) {
    const user = getUser(req);
    if (!user.orgId) throw new UnauthorizedException('No organization assigned');
    return this.predictionsService.getCasePredictions(id, user.orgId);
  }

  @Get('practice-analytics')
  @RequirePermission('analytics:read')
  async getPracticeAnalytics(
    @Req() req: Request,
    @Query('period') period?: string,
  ) {
    const user = getUser(req);
    if (!user.orgId) throw new UnauthorizedException('No organization assigned');
    const days = period ? Math.min(365, Math.max(7, parseInt(period, 10))) : 30;
    return this.predictionsService.getPracticeAnalytics(user.orgId, days);
  }
}
