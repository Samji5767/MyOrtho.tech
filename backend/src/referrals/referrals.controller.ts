import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { ReferralsService } from './referrals.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api')
@UseGuards(AuthGuard)
export class ReferralsController {
  constructor(private readonly svc: ReferralsService) {}

  @Get('referrals')
  listOrg(@Req() req: Request, @Query('status') status?: string) {
    return this.svc.listOrgReferrals(getUser(req).orgId, status);
  }

  @Get('cases/:caseId/referrals')
  listCase(@Req() req: Request, @Param('caseId') caseId: string) {
    return this.svc.listReferrals(caseId, getUser(req).orgId);
  }

  @Post('cases/:caseId/referrals')
  create(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() body: { referralType: string; recipientName: string; recipientEmail?: string; recipientPhone?: string; urgency?: string; reason: string; clinicalNotes?: string },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.createReferral(caseId, orgId, id, body);
  }

  @Post('referrals/:referralId/send')
  send(@Req() req: Request, @Param('referralId') referralId: string) {
    return this.svc.sendReferral(referralId, getUser(req).orgId);
  }

  @Patch('referrals/:referralId/response')
  updateResponse(
    @Req() req: Request,
    @Param('referralId') referralId: string,
    @Body() body: { status: string; responseNotes?: string },
  ) {
    return this.svc.updateReferralResponse(referralId, getUser(req).orgId, body);
  }
}
