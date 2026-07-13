import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req, UnauthorizedException, BadRequestException, Query } from '@nestjs/common';
import type { Request } from 'express';
import { ScannerService } from './scanner.service';
import { AuthGuard } from '../auth/auth.guard';

interface AuthUser { id: string; orgId: string | null }

function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('scanner')
@UseGuards(AuthGuard)
export class ScannerController {
  constructor(private readonly scannerService: ScannerService) {}

  // ─── Integration CRUD ───────────────────────────────────────────────────────

  @Get('integrations')
  listIntegrations(@Req() req: Request) {
    return this.scannerService.listIntegrations(getUser(req).orgId);
  }

  @Post('integrations')
  createIntegration(
    @Req() req: Request,
    @Body() body: { vendor: string; apiEndpoint?: string; authCredentials?: Record<string, string>; isActive?: boolean },
  ) {
    return this.scannerService.upsertIntegration(getUser(req).orgId, body);
  }

  @Patch('integrations/:id')
  updateIntegration(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { apiEndpoint?: string; authCredentials?: Record<string, string>; isActive?: boolean },
  ) {
    return this.scannerService.updateIntegration(id, getUser(req).orgId, body);
  }

  @Post('sync')
  async syncScan(
    @Req() req: Request,
    @Body() body: { vendor: string; externalId: string }
  ) {
    const { orgId } = getUser(req);
    const { vendor, externalId } = body;
    if (!vendor || !externalId) {
      throw new BadRequestException('vendor and externalId are required');
    }
    return this.scannerService.importScanFromDevice(orgId, vendor, externalId);
  }

  @Get('diagnostics')
  async getDiagnostics(@Req() req: Request, @Query('vendor') vendor?: string) {
    getUser(req); // enforce org context; diagnostics are org-scoped

    const vendorsToCheck = vendor ? [vendor] : ['3shape', 'medit', 'itero', 'shining3d', 'carestream'];
    const diagnostics: Record<string, { status: string; authenticated: boolean; timestamp: string }> = {};

    for (const v of vendorsToCheck) {
      try {
        const connector = this.scannerService.getConnector(v);
        const authenticated = await connector.authenticate();
        diagnostics[v] = {
          status: 'online',
          authenticated,
          timestamp: new Date().toISOString()
        };
      } catch {
        diagnostics[v] = {
          status: 'error',
          authenticated: false,
          timestamp: new Date().toISOString()
        };
      }
    }

    return diagnostics;
  }
}
