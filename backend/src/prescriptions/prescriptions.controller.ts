import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PrescriptionsService } from './prescriptions.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api')
@UseGuards(AuthGuard)
export class PrescriptionsController {
  constructor(private readonly svc: PrescriptionsService) {}

  @Get('prescriptions')
  listOrg(@Req() req: Request, @Query('status') status?: string) {
    return this.svc.listOrgRx(getUser(req).orgId, status);
  }

  @Get('cases/:caseId/prescriptions')
  list(@Req() req: Request, @Param('caseId') caseId: string) {
    return this.svc.listRx(caseId, getUser(req).orgId);
  }

  @Post('cases/:caseId/prescriptions')
  create(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() body: { medicationName: string; strength?: string; dosageForm?: string; sig: string; quantity: string; refills?: number; indication?: string; expiresAt?: string },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.createRx(caseId, orgId, id, body);
  }

  @Patch('prescriptions/:rxId/fill')
  fill(@Req() req: Request, @Param('rxId') rxId: string) {
    return this.svc.fillRx(rxId, getUser(req).orgId);
  }

  @Patch('prescriptions/:rxId/cancel')
  cancel(@Req() req: Request, @Param('rxId') rxId: string) {
    return this.svc.cancelRx(rxId, getUser(req).orgId);
  }
}
