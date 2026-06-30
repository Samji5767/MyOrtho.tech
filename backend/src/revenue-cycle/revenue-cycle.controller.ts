import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { RevenueCycleService } from './revenue-cycle.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/revenue')
@UseGuards(AuthGuard)
export class RevenueCycleController {
  constructor(private readonly svc: RevenueCycleService) {}

  @Get()
  list(
    @Req() req: Request,
    @Query('caseId') caseId?: string,
    @Query('patientId') patientId?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.list(getUser(req).orgId, { caseId, patientId, status });
  }

  @Get('summary')
  summary(
    @Req() req: Request,
    @Query('caseId') caseId?: string,
    @Query('patientId') patientId?: string,
  ) { return this.svc.getSummary(getUser(req).orgId, { caseId, patientId }); }

  @Post()
  create(
    @Req() req: Request,
    @Body() body: { caseId?: string; patientId?: string; transactionType: string; amountCents: number; currency?: string; description?: string; cdtCode?: string },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.create(orgId, id, body);
  }

  @Patch(':id/post')
  post(@Req() req: Request, @Param('id') id: string) {
    return this.svc.post(id, getUser(req).orgId);
  }
}
