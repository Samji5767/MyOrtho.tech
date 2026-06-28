import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PreexportQaService } from './preexport-qa.service';

@Controller()
@UseGuards(AuthGuard)
export class PreexportQaController {
  constructor(private readonly svc: PreexportQaService) {}

  @Get('api/cases/:caseId/preexport-qa')
  list(@Req() req: any, @Param('caseId') caseId: string) {
    return this.svc.list(caseId, req.user.organizationId);
  }

  @Post('api/cases/:caseId/preexport-qa/run')
  run(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Body() dto: { treatmentPlanId?: string },
  ) {
    return this.svc.runQA(caseId, req.user.organizationId, req.user.sub, dto);
  }

  @Post('api/cases/:caseId/preexport-qa/:reportId/approve')
  approve(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('reportId') reportId: string,
    @Body() dto: { notes?: string },
  ) {
    return this.svc.approve(caseId, req.user.organizationId, req.user.sub, reportId, dto);
  }
}
