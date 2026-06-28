import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ManufacturePrepService, type CreateExportDto } from './manufacture-prep.service';

@Controller()
@UseGuards(AuthGuard)
export class ManufacturePrepController {
  constructor(private readonly svc: ManufacturePrepService) {}

  @Get('api/cases/:caseId/manufacture/exports')
  list(@Req() req: any, @Param('caseId') caseId: string) {
    return this.svc.listExports(caseId, req.user.organizationId);
  }

  @Post('api/cases/:caseId/manufacture/exports')
  create(@Req() req: any, @Param('caseId') caseId: string, @Body() dto: CreateExportDto) {
    return this.svc.createExport(caseId, req.user.organizationId, req.user.sub, dto);
  }

  @Get('api/cases/:caseId/manufacture/exports/:exportId')
  getOne(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('exportId') exportId: string,
  ) {
    return this.svc.getExport(caseId, req.user.organizationId, exportId);
  }
}
