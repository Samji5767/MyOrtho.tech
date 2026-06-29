import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { DeviceTrackingService } from './device-tracking.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/device-batches')
@UseGuards(AuthGuard)
export class DeviceTrackingController {
  constructor(private readonly svc: DeviceTrackingService) {}

  @Get()
  list(@Req() req: Request, @Query('status') status?: string) {
    return this.svc.list(getUser(req).orgId, status);
  }

  @Post()
  create(@Req() req: Request, @Body() body: { batchCode: string; deviceType?: string; materialLot?: string; manufactureDate?: string; expiryDate?: string; caseIds?: string[] }) {
    return this.svc.create(getUser(req).orgId, body);
  }

  @Patch(':id/recall')
  recall(@Req() req: Request, @Param('id') id: string, @Body() body: { reason: string }) {
    return this.svc.recall(id, getUser(req).orgId, body.reason);
  }

  @Patch(':id/quarantine')
  quarantine(@Req() req: Request, @Param('id') id: string) {
    return this.svc.quarantine(id, getUser(req).orgId);
  }

  @Post(':id/cases')
  addCases(@Req() req: Request, @Param('id') id: string, @Body() body: { caseIds: string[] }) {
    return this.svc.addCases(id, getUser(req).orgId, body.caseIds);
  }
}
