import {
  Controller,
  Get,
  Param,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { OrganizationsService } from './organizations.service';

interface AuthedRequest extends Request {
  user: { id: string; email: string; role: string; name: string; orgId: string | null; jti: string };
}

function getUser(req: Request): AuthedRequest['user'] {
  const u = (req as AuthedRequest).user;
  if (!u) throw new UnauthorizedException('No session');
  return u;
}

@Controller('api/organizations')
@UseGuards(AuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  /** List all organizations the authenticated user belongs to. */
  @Get()
  async listMyOrganizations(@Req() req: Request) {
    const user = getUser(req);
    const orgs = await this.organizationsService.listMyOrganizations(user.id);
    return { organizations: orgs };
  }

  /** Get details of a specific organization (membership verified server-side). */
  @Get(':id')
  async getOrganization(@Req() req: Request, @Param('id') orgId: string) {
    const user = getUser(req);
    const org = await this.organizationsService.getOrganization(user.id, orgId);
    return { organization: org };
  }

  /** List members of an organization (membership verified server-side). */
  @Get(':id/members')
  async getMembers(@Req() req: Request, @Param('id') orgId: string) {
    const user = getUser(req);
    const members = await this.organizationsService.getMembers(user.id, orgId);
    return { members };
  }

  /** List workspaces within an organization (membership verified server-side). */
  @Get(':id/workspaces')
  async getWorkspaces(@Req() req: Request, @Param('id') orgId: string) {
    const user = getUser(req);
    const workspaces = await this.organizationsService.getWorkspaces(user.id, orgId);
    return { workspaces };
  }
}
