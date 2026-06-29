import { Controller, Get, Post, Body, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PrinterMaintenanceService } from './printer-maintenance.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/printer-maintenance')
@UseGuards(AuthGuard)
export class PrinterMaintenanceController {
  constructor(private readonly svc: PrinterMaintenanceService) {}

  @Get()
  list(@Req() req: Request, @Query('printerId') printerId?: string) {
    return this.svc.listLogs(getUser(req).orgId, printerId);
  }

  @Get('due')
  due(@Req() req: Request) {
    return this.svc.getDueForMaintenance(getUser(req).orgId);
  }

  @Post()
  log(
    @Req() req: Request,
    @Body() body: { printerId?: string; maintenanceType?: string; notes?: string; nextDueDate?: string; passed?: boolean; performedAt?: string },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.logMaintenance(orgId, id, body);
  }
}
