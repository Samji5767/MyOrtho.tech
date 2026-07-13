import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ManufacturePrepService, type CreateExportDto } from './manufacture-prep.service';


interface AuthUser { id: string; orgId: string | null }

function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller()
@UseGuards(AuthGuard, PermissionsGuard)
export class ManufacturePrepController {
  constructor(private readonly svc: ManufacturePrepService) {}

  @Get('api/cases/:caseId/manufacture/exports')
  @RequirePermission('manufacturing:read')
  list(@Req() req: Request, @Param('caseId') caseId: string) {
    return this.svc.listExports(caseId, getUser(req).orgId);
  }

  @Post('api/cases/:caseId/manufacture/exports')
  @RequirePermission('manufacturing:write')
  create(@Req() req: Request, @Param('caseId') caseId: string, @Body() dto: CreateExportDto) {
    const { id, orgId } = getUser(req);
    return this.svc.createExport(caseId, orgId, id, dto);
  }

  @Get('api/cases/:caseId/manufacture/exports/:exportId')
  @RequirePermission('manufacturing:read')
  getOne(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('exportId', new ParseUUIDPipe()) exportId: string,
  ) {
    return this.svc.getExport(caseId, getUser(req).orgId, exportId);
  }

  @Get('api/cases/:caseId/manufacture/readiness')
  @RequirePermission('manufacturing:read')
  getReadiness(@Req() req: Request, @Param('caseId') caseId: string) {
    return this.svc.getManufacturingReadiness(caseId, getUser(req).orgId);
  }
}
