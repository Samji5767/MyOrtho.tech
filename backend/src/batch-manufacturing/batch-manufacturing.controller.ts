import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { BatchManufacturingService } from './batch-manufacturing.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/manufacturing-batches')
@UseGuards(AuthGuard)
export class BatchManufacturingController {
  constructor(private readonly svc: BatchManufacturingService) {}

  @Get()
  list(@Req() req: Request, @Query('status') status?: string) {
    return this.svc.list(getUser(req).orgId, status);
  }

  @Post()
  create(@Req() req: Request, @Body() body: { caseIds?: string[]; scheduledDate?: string; notes?: string }) {
    const { id, orgId } = getUser(req);
    return this.svc.create(orgId, id, body);
  }

  @Patch(':id/status')
  updateStatus(@Req() req: Request, @Param('id') id: string, @Body() body: { status: string }) {
    return this.svc.updateStatus(id, getUser(req).orgId, body.status);
  }

  @Post(':id/cases')
  addCases(@Req() req: Request, @Param('id') id: string, @Body() body: { caseIds: string[] }) {
    return this.svc.addCases(id, getUser(req).orgId, body.caseIds);
  }
}
