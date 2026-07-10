import { Controller, Get, Post, Param, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ExportPackageService, ExportType } from './export-package.service';
import type { AuthenticatedRequest } from '../common/auth-request.type';

@Controller()
@UseGuards(AuthGuard, PermissionsGuard)
export class ExportPackageController {
  constructor(private readonly svc: ExportPackageService) {}

  @Post('api/cases/:caseId/plans/:planId/export-packages')
  @RequirePermission('cases:send_to_manufacturing')
  create(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Body('exportType') exportType: ExportType,
  ) {
    return this.svc.createPackage(caseId, req.user.orgId, req.user.id, planId, exportType);
  }

  @Get('api/cases/:caseId/plans/:planId/export-packages')
  @RequirePermission('cases:read')
  list(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.listPackages(caseId, req.user.orgId, planId);
  }

  @Post('api/cases/:caseId/plans/:planId/export-packages/:packageId/validate')
  @RequirePermission('cases:send_to_manufacturing')
  validate(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Param('packageId') packageId: string,
  ) {
    return this.svc.validatePackage(caseId, req.user.orgId, planId, packageId);
  }

  @Post('api/cases/:caseId/plans/:planId/export-packages/:packageId/approve')
  @RequirePermission('cases:send_to_manufacturing')
  approve(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Param('packageId') packageId: string,
  ) {
    return this.svc.approvePackage(caseId, req.user.orgId, req.user.id, planId, packageId);
  }

  @Post('api/cases/:caseId/plans/:planId/export-packages/:packageId/mark-exported')
  @RequirePermission('cases:send_to_manufacturing')
  markExported(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Param('packageId') packageId: string,
    @Body('format') format: string,
    @Body('fileSizeBytes') fileSizeBytes: number,
  ) {
    return this.svc.markExported(caseId, req.user.orgId, planId, packageId, format, fileSizeBytes);
  }
}
