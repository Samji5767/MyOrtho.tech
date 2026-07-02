import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { SsoService, type SsoProvider } from './sso.service';

interface AuthUser { id: string; orgId: string | null; role: string }

function getUser(req: Request): { id: string; orgId: string; role: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId, role: u.role };
}

@Controller('api/sso')
@UseGuards(AuthGuard)
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}

  /**
   * GET /api/sso/status
   * Returns the SSO configuration status for the caller's organization.
   * Available to all authenticated users so the login page can redirect
   * SSO users automatically.
   */
  @Get('status')
  async getStatus(@Req() req: Request) {
    const { orgId } = getUser(req);
    return this.ssoService.getStatus(orgId);
  }

  /**
   * GET /api/sso/config
   * Returns the active SSO configuration (non-secret fields only).
   * Requires admin or super_admin role.
   */
  @Get('config')
  @UseGuards(PermissionsGuard)
  async getConfig(@Req() req: Request) {
    const { orgId, role } = getUser(req);
    if (!['admin', 'super_admin'].includes(role)) {
      throw new UnauthorizedException('Admin role required');
    }
    const config = await this.ssoService.getConfiguration(orgId);
    if (!config) {
      return {
        configured: false,
        message:
          'No SSO provider configured. SSO/SAML/OIDC integration is not yet active in this release.',
      };
    }
    return config;
  }

  /**
   * POST /api/sso/config
   * Creates or updates an SSO provider configuration.
   * Requires admin or super_admin role.
   *
   * NOTE: This endpoint stores non-secret configuration fields only.
   * The SSO authentication flow is not yet implemented — configuring a
   * provider here does not enable SSO login. This is a configuration
   * placeholder for a future implementation.
   */
  @Post('config')
  @UseGuards(PermissionsGuard)
  @HttpCode(HttpStatus.CREATED)
  async createConfig(
    @Req() req: Request,
    @Body() body: {
      provider: SsoProvider;
      emailDomain?: string;
      displayName?: string;
      entityId?: string;
      ssoUrl?: string;
      discoveryUrl?: string;
      clientId?: string;
    },
  ) {
    const { id, orgId, role } = getUser(req);
    if (!['admin', 'super_admin'].includes(role)) {
      throw new UnauthorizedException('Admin role required');
    }
    const config = await this.ssoService.createConfiguration(orgId, id, body);
    return {
      ...config,
      warning:
        'SSO authentication flow is not yet implemented. ' +
        'This configuration record is stored but will not enable SSO login until ' +
        'the SAML/OIDC callback handler is implemented and deployed.',
    };
  }

  /**
   * DELETE /api/sso/config/:provider
   * Removes an SSO provider configuration.
   * Requires admin or super_admin role.
   */
  @Delete('config/:provider')
  @UseGuards(PermissionsGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConfig(@Req() req: Request, @Param('provider') provider: SsoProvider) {
    const { orgId, role } = getUser(req);
    if (!['admin', 'super_admin'].includes(role)) {
      throw new UnauthorizedException('Admin role required');
    }
    await this.ssoService.deleteConfiguration(orgId, provider);
  }
}
