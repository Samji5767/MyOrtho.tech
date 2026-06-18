import { Controller, Get, Post, Body, UseGuards, Req, ForbiddenException, BadRequestException, Query } from '@nestjs/common';
import { ScannerService } from './scanner.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('scanner')
@UseGuards(AuthGuard)
export class ScannerController {
  constructor(private readonly scannerService: ScannerService) {}

  @Post('sync')
  async syncScan(
    @Req() req,
    @Body() body: { vendor: string; externalId: string }
  ) {
    const orgId = req.user.organizationId;
    if (!orgId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    const { vendor, externalId } = body;
    if (!vendor || !externalId) {
      throw new BadRequestException('vendor and externalId are required');
    }
    return this.scannerService.importScanFromDevice(orgId, vendor, externalId);
  }

  @Get('diagnostics')
  async getDiagnostics(@Req() req, @Query('vendor') vendor?: string) {
    const orgId = req.user.organizationId;
    if (!orgId) {
      throw new ForbiddenException('User is not associated with an organization');
    }

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
      } catch (err) {
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
