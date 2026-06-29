import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PrintFarmService } from './print-farm.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/print-jobs')
@UseGuards(AuthGuard)
export class PrintFarmController {
  constructor(private readonly svc: PrintFarmService) {}

  @Get()
  list(@Req() req: Request, @Query('status') status?: string) {
    return this.svc.listJobs(getUser(req).orgId, status);
  }

  @Post()
  create(@Req() req: Request, @Body() body: { caseId?: string; printerId?: string; jobName: string; material?: string; layerHeightUm?: number; notes?: string }) {
    const { id, orgId } = getUser(req);
    return this.svc.createJob(orgId, id, body);
  }

  @Patch(':id/advance')
  advance(@Req() req: Request, @Param('id') id: string, @Body() body: { printDurationMinutes?: number; notes?: string }) {
    return this.svc.advanceStatus(id, getUser(req).orgId, body);
  }

  @Patch(':id/fail')
  fail(@Req() req: Request, @Param('id') id: string, @Body() body: { notes?: string }) {
    return this.svc.failJob(id, getUser(req).orgId, body.notes);
  }
}
