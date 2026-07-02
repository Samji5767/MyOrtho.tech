import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
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
   * GET /api/sso/metadata
   * Returns SAML 2.0 SP metadata XML for this application.
   * Requires admin authentication — download this to configure your Identity Provider.
   * AuthnRequests are not signed (no SP private key). Assertions must be signed by the IdP.
   */
  @Get('metadata')
  @UseGuards(PermissionsGuard)
  getMetadata(@Req() req: Request, @Res() res: Response) {
    const { role } = getUser(req);
    if (!['admin', 'super_admin'].includes(role)) {
      throw new UnauthorizedException('Admin role required');
    }
    const proto  = (req.headers['x-forwarded-proto'] as string | undefined) ?? req.protocol;
    const host   = (req.headers['x-forwarded-host'] as string | undefined) ?? req.get('host') ?? 'localhost';
    const baseUrl = `${proto}://${host}`;
    const xml = this.ssoService.generateSpMetadata(baseUrl);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="myortho-sp-metadata.xml"');
    res.send(xml);
  }

  /**
   * GET /api/sso/initiate
   * Returns SSO initiation information for this organization.
   * For SAML: returns the IdP SSO URL for redirect.
   * For OIDC: returns a note that openid-client library is required.
   * Does NOT produce a signed SAML AuthnRequest.
   */
  @Get('initiate')
  async getInitiate(@Req() req: Request) {
    const { orgId } = getUser(req);
    return this.ssoService.getInitiateInfo(orgId);
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
