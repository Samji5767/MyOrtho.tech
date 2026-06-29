import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { EmergencyProtocolsService } from './emergency-protocols.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/emergency-protocols')
@UseGuards(AuthGuard)
export class EmergencyProtocolsController {
  constructor(private readonly svc: EmergencyProtocolsService) {}

  @Get()
  list(@Req() req: Request, @Query('category') category?: string) {
    return this.svc.list(getUser(req).orgId, category);
  }

  @Post()
  create(@Req() req: Request, @Body() body: { protocolName: string; category?: string; steps?: unknown[] }) {
    return this.svc.create(getUser(req).orgId, body);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() body: { protocolName?: string; category?: string; steps?: unknown[] }) {
    return this.svc.update(id, getUser(req).orgId, body);
  }

  @Patch(':id/review')
  markReviewed(@Req() req: Request, @Param('id') id: string) {
    const { id: userId, orgId } = getUser(req);
    return this.svc.markReviewed(id, orgId, userId);
  }
}
