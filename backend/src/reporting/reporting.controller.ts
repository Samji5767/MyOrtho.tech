import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ReportingService } from './reporting.service';

@Controller('api/cases/:caseId/reports')
@UseGuards(AuthGuard)
export class ReportingController {
  constructor(private readonly svc: ReportingService) {}

  private ctx(req: Request) {
    return (req as unknown as { user: { id: string; orgId: string } }).user;
  }

  @Get()
  list(@Req() req: Request, @Param('caseId') caseId: string) {
    const { orgId } = this.ctx(req);
    return this.svc.listCaseReports(caseId, orgId);
  }

  @Get('data')
  getData(@Req() req: Request, @Param('caseId') caseId: string) {
    const { orgId } = this.ctx(req);
    return this.svc.generateCaseReport(caseId, orgId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  requestReport(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() body: { reportType?: string },
  ) {
    const { orgId, id: userId } = this.ctx(req);
    return this.svc.requestReport(caseId, orgId, body.reportType ?? 'clinical_summary', userId);
  }
}
