import { Controller, ForbiddenException, Get, Post, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { FeatureFlagsService } from './feature-flags.service';

interface AuthUser { id: string; orgId: string | null; role?: string }
function getUser(req: Request): { id: string; orgId: string; role: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId, role: u.role ?? '' };
}

@Controller('api/features')
@UseGuards(AuthGuard)
export class FeatureFlagsController {
  constructor(private readonly svc: FeatureFlagsService) {}

  @Get()
  list(@Req() req: Request) { return this.svc.listFlags(getUser(req).orgId); }

  @Get(':flagName')
  getFlag(@Req() req: Request, @Param('flagName') flagName: string) {
    return this.svc.getFlag(getUser(req).orgId, flagName).then(enabled => ({ flagName, enabled }));
  }

  @Post('evaluate')
  evaluate(@Req() req: Request, @Body() body: { flags: string[] }) {
    return this.svc.evaluateFlags(getUser(req).orgId, body.flags);
  }

  @Post(':flagName')
  setFlag(
    @Req() req: Request,
    @Param('flagName') flagName: string,
    @Body() body: { isEnabled: boolean; rolloutPercent?: number; conditions?: Record<string, unknown> },
  ) {
    const { orgId, role } = getUser(req);
    if (role !== 'admin' && role !== 'super_admin') {
      throw new ForbiddenException('Feature flag management requires admin role');
    }
    return this.svc.setFlag(orgId, flagName, body);
  }
}
