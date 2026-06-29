import { Controller, Get, Post, Body, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { MaterialTestingService } from './material-testing.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/material-tests')
@UseGuards(AuthGuard)
export class MaterialTestingController {
  constructor(private readonly svc: MaterialTestingService) {}

  @Get()
  list(@Req() req: Request, @Query('materialName') materialName?: string) {
    return this.svc.list(getUser(req).orgId, materialName);
  }

  @Get('stats')
  stats(@Req() req: Request) { return this.svc.getStats(getUser(req).orgId); }

  @Post()
  create(
    @Req() req: Request,
    @Body() body: { materialName: string; lotNumber?: string; testDate: string; testType?: string; resultValue?: number; resultUnit?: string; passThreshold?: number; notes?: string },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.create(orgId, id, body);
  }
}
