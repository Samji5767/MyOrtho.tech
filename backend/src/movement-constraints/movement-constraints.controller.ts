import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { MovementConstraintsService } from './movement-constraints.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/movement-constraints')
@UseGuards(AuthGuard)
export class MovementConstraintsController {
  constructor(private readonly svc: MovementConstraintsService) {}

  @Get()
  list(@Req() req: Request) { return this.svc.list(getUser(req).orgId); }

  @Post()
  create(@Req() req: Request, @Body() body: { name: string; maxTranslationMm?: number; maxRotationDeg?: number; maxTorqueDeg?: number; maxTipDeg?: number; maxIntrusionMm?: number; maxExtrusionMm?: number }) {
    return this.svc.create(getUser(req).orgId, body);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() body: { name?: string; maxTranslationMm?: number; maxRotationDeg?: number; maxTorqueDeg?: number; maxTipDeg?: number; maxIntrusionMm?: number; maxExtrusionMm?: number }) {
    return this.svc.update(id, getUser(req).orgId, body);
  }

  @Post(':id/validate')
  validate(@Req() req: Request, @Param('id') id: string, @Body() body: { translationMm?: number; rotationDeg?: number; torqueDeg?: number; tipDeg?: number; intrusionMm?: number; extrusionMm?: number }) {
    return this.svc.validate(getUser(req).orgId, id, body);
  }
}
