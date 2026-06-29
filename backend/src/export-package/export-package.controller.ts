import { Controller, Get, Post, Param, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ExportPackageService, ExportType } from './export-package.service';

@Controller()
@UseGuards(AuthGuard)
export class ExportPackageController {
  constructor(private readonly svc: ExportPackageService) {}

  @Post('api/cases/:caseId/plans/:planId/export-packages')
  create(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Body('exportType') exportType: ExportType,
  ) {
    return this.svc.createPackage(caseId, req.user.orgId, req.user.id, planId, exportType);
  }

  @Get('api/cases/:caseId/plans/:planId/export-packages')
  list(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.listPackages(caseId, req.user.orgId, planId);
  }

  @Post('api/cases/:caseId/plans/:planId/export-packages/:packageId/validate')
  validate(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Param('packageId') packageId: string,
  ) {
    return this.svc.validatePackage(caseId, req.user.orgId, planId, packageId);
  }

  @Post('api/cases/:caseId/plans/:planId/export-packages/:packageId/approve')
  approve(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Param('packageId') packageId: string,
  ) {
    return this.svc.approvePackage(caseId, req.user.orgId, req.user.id, planId, packageId);
  }

  @Post('api/cases/:caseId/plans/:planId/export-packages/:packageId/mark-exported')
  markExported(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Param('packageId') packageId: string,
    @Body('format') format: string,
    @Body('fileSizeBytes') fileSizeBytes: number,
  ) {
    return this.svc.markExported(caseId, req.user.orgId, planId, packageId, format, fileSizeBytes);
  }
}
