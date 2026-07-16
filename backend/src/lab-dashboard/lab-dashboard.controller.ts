import {
  Controller,
  Get,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { LabDashboardService } from './lab-dashboard.service';

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

@Controller('api/lab/dashboard')
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermission('manufacturing:read')
export class LabDashboardController {
  constructor(private readonly service: LabDashboardService) {}

  @Get()
  getDashboard(@Req() req: Request) {
    const user = getUser(req);
    return this.service.getDashboard(user.orgId!);
  }
}
