import { Controller, Get, Query, Req, Res, UseGuards, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ReportsService } from './reports.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

function periodToDays(period?: string): number | undefined {
  if (period === 'last_90_days') return 90;
  if (period === 'last_12_months') return 365;
  if (period === 'all') return undefined;
  return 30;
}

@Controller('api/reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('practice-summary')
  @UseGuards(PermissionsGuard)
  @RequirePermission('analytics:read')
  getPracticeSummary(@Req() req: Request, @Query('period') period?: string) {
    return this.svc.getPracticeSummary(getUser(req).orgId, periodToDays(period) ?? 30);
  }

  @Get('clinical-kpis')
  @UseGuards(PermissionsGuard)
  @RequirePermission('analytics:read')
  getClinicalKpis(@Req() req: Request, @Query('period') period?: string) {
    return this.svc.getClinicalKpis(getUser(req).orgId, periodToDays(period) ?? 30);
  }

  @Get('manufacturing-kpis')
  @UseGuards(PermissionsGuard)
  @RequirePermission('manufacturing:read')
  getManufacturingKpis(@Req() req: Request, @Query('period') period?: string) {
    return this.svc.getManufacturingKpis(getUser(req).orgId, periodToDays(period) ?? 30);
  }

  @Get('ai-utilization')
  @UseGuards(PermissionsGuard)
  @RequirePermission('mlops:read')
  getAiUtilization(@Req() req: Request, @Query('period') period?: string) {
    return this.svc.getAiUtilizationReport(getUser(req).orgId, periodToDays(period) ?? 30);
  }

  @Get('dashboard/html')
  @UseGuards(PermissionsGuard)
  @RequirePermission('analytics:read')
  async getDashboardHtml(
    @Req() req: Request,
    @Res() res: Response,
    @Query('period') period?: string,
  ) {
    const html = await this.svc.getDashboardHtml(getUser(req).orgId, periodToDays(period) ?? 30);
    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="myortho-dashboard-${new Date().toISOString().slice(0, 10)}.html"`,
    });
    res.send(html);
  }

  @Get('cases/csv')
  @UseGuards(PermissionsGuard)
  @RequirePermission('analytics:read')
  async getCasesCSV(
    @Req() req: Request,
    @Res() res: Response,
    @Query('period') period?: string,
  ) {
    const csv = await this.svc.getCasesCSV(getUser(req).orgId, periodToDays(period));
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="myortho-cases-${new Date().toISOString().slice(0, 10)}.csv"`,
    });
    res.send(csv);
  }
}
