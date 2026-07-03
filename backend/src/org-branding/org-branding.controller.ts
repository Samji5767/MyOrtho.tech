import { Controller, Get, Put, Body, Req, UseGuards, ForbiddenException, Query } from '@nestjs/common';
import type { Request } from 'express';
import { OrgBrandingService } from './org-branding.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('api/org-branding')
export class OrgBrandingController {
  constructor(private readonly branding: OrgBrandingService) {}

  /** Unauthenticated — used by frontend to load white-label config on page load */
  @Get('public')
  async getPublic(@Query('domain') domain?: string, @Query('orgId') orgId?: string) {
    if (domain) {
      return this.branding.getBrandingByDomain(domain);
    }
    if (orgId) {
      return this.branding.getBranding(orgId);
    }
    return null;
  }

  @Get()
  @UseGuards(AuthGuard)
  async get(@Req() req: Request) {
    const orgId = (req as any).user?.orgId;
    if (!orgId) throw new ForbiddenException('No organization');
    return this.branding.getBranding(orgId);
  }

  @Put()
  @UseGuards(AuthGuard)
  async update(@Req() req: Request, @Body() body: Record<string, string>) {
    const user = (req as any).user;
    if (!user?.orgId) throw new ForbiddenException('No organization');
    const allowedRoles = ['super_admin', 'admin', 'clinical_director'];
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenException('Only clinic admins can update branding');
    }
    return this.branding.updateBranding(user.orgId, user.id, body);
  }
}
