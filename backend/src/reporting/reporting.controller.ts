import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ReportingService } from './reporting.service';

@Controller('api/cases/:caseId/reports')
@UseGuards(AuthGuard)
export class ReportingController {
  constructor(private readonly svc: ReportingService) {}

  private ctx(req: Request) {
    return (req as unknown as { user: { id: string; organizationId: string } }).user;
  }

  @Get()
  list(@Req() req: Request, @Param('caseId') caseId: string) {
    const { organizationId } = this.ctx(req);
    return this.svc.listCaseReports(caseId, organizationId);
  }

  @Get('data')
  getData(@Req() req: Request, @Param('caseId') caseId: string) {
    const { organizationId } = this.ctx(req);
    return this.svc.generateCaseReport(caseId, organizationId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  requestReport(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() body: { reportType?: string },
  ) {
    const { organizationId, id: userId } = this.ctx(req);
    return this.svc.requestReport(caseId, organizationId, body.reportType ?? 'clinical_summary', userId);
  }
}
