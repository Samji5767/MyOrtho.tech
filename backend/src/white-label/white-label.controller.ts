import { Controller, Get, Patch, Body, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { WhiteLabelService } from './white-label.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/branding')
@UseGuards(AuthGuard)
export class WhiteLabelController {
  constructor(private readonly svc: WhiteLabelService) {}

  @Get()
  get(@Req() req: Request) {
    return this.svc.getBranding(getUser(req).orgId);
  }

  @Patch()
  update(
    @Req() req: Request,
    @Body() body: Partial<{ clinicName: string; logoUrl: string; primaryColor: string; secondaryColor: string; accentColor: string; customDomain: string; footerText: string }>,
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.updateBranding(orgId, id, body);
  }
}
