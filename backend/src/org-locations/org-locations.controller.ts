import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { OrgLocationsService } from './org-locations.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/org-locations')
@UseGuards(AuthGuard)
export class OrgLocationsController {
  constructor(private readonly svc: OrgLocationsService) {}

  @Get()
  list(@Req() req: Request, @Query('all') all?: string) {
    return this.svc.list(getUser(req).orgId, all !== 'true');
  }

  @Post()
  create(@Req() req: Request, @Body() body: { name: string; addressLine1?: string; city?: string; state?: string; postalCode?: string; country?: string; phone?: string; email?: string; isPrimary?: boolean; timezone?: string }) {
    return this.svc.create(getUser(req).orgId, body);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.svc.update(id, getUser(req).orgId, body as Parameters<OrgLocationsService['update']>[2]);
  }
}
