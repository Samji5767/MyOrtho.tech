import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { IntegrationProvidersService } from './integration-providers.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/integration-providers')
@UseGuards(AuthGuard)
export class IntegrationProvidersController {
  constructor(private readonly svc: IntegrationProvidersService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('integrations:read')
  list(@Req() req: Request, @Query('type') type?: string) {
    const { orgId } = getUser(req);
    return this.svc.list(orgId, type);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('integrations:read')
  get(@Req() req: Request, @Param('id') id: string) {
    const { orgId } = getUser(req);
    return this.svc.get(id, orgId);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('integrations:write')
  create(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const { id, orgId } = getUser(req);
    return this.svc.create(orgId, id, {
      providerType: body['providerType'] as string,
      name: body['name'] as string,
      vendor: body['vendor'] as string | undefined,
      version: body['version'] as string | undefined,
      configJson: body['configJson'] as Record<string, unknown> | undefined,
      capabilitiesJson: body['capabilitiesJson'] as unknown[] | undefined,
      enabled: body['enabled'] as boolean | undefined,
    });
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('integrations:write')
  update(@Req() req: Request, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const { orgId } = getUser(req);
    return this.svc.update(id, orgId, {
      name: body['name'] as string | undefined,
      vendor: body['vendor'] as string | undefined,
      version: body['version'] as string | undefined,
      configJson: body['configJson'] as Record<string, unknown> | undefined,
      capabilitiesJson: body['capabilitiesJson'] as unknown[] | undefined,
      enabled: body['enabled'] as boolean | undefined,
    });
  }

  @Post('run-health-checks')
  @UseGuards(PermissionsGuard)
  @RequirePermission('integrations:write')
  runHealthChecks(@Req() req: Request) {
    const { id, orgId } = getUser(req);
    return this.svc.scheduleHealthChecks(orgId, id);
  }

  @Post(':id/health-check')
  @UseGuards(PermissionsGuard)
  @RequirePermission('integrations:write')
  healthCheck(@Req() req: Request, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const { orgId } = getUser(req);
    return this.svc.recordHealthCheck(id, orgId, {
      status: body['status'] as string,
      responseTimeMs: body['responseTimeMs'] as number | undefined,
      errorMessage: body['errorMessage'] as string | undefined,
    });
  }

  @Get(':id/health-logs')
  @UseGuards(PermissionsGuard)
  @RequirePermission('integrations:read')
  healthLogs(@Req() req: Request, @Param('id') id: string, @Query('limit') limit?: string) {
    const { orgId } = getUser(req);
    return this.svc.getHealthLogs(id, orgId, limit ? parseInt(limit, 10) : 50);
  }
}
