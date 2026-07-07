import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { QcService, QCCheckStatus } from './qc.service';
import type { AuthenticatedRequest } from '../common/auth-request.type';

@Controller('api/qc')
@UseGuards(AuthGuard)
export class QcController {
  constructor(private readonly qc: QcService) {}

  @Get('jobs')
  listJobs(@Request() req: AuthenticatedRequest, @Query('limit') limit?: string) {
    return this.qc.listJobs(req.user.orgId, limit ? Number(limit) : undefined);
  }

  @Post('jobs/:jobId/init')
  initChecks(@Param('jobId') jobId: string, @Request() req: AuthenticatedRequest) {
    return this.qc.initChecks(jobId, req.user.orgId);
  }

  @Patch('jobs/:jobId/checks/:checkId')
  updateCheck(
    @Param('jobId') jobId: string,
    @Param('checkId') checkId: string,
    @Body() body: { status: QCCheckStatus; measuredValue?: number; notes?: string },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.qc.updateCheck(jobId, checkId, req.user.orgId, {
      ...body,
      checkedBy: req.user.id,
    });
  }
}
