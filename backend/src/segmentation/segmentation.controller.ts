import {
  Body, Controller, Get, Param, Patch, Post, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { SegmentationService, type CreateJobDto, type CorrectionDto } from './segmentation.service';

@Controller()
@UseGuards(AuthGuard)
export class SegmentationController {
  constructor(private readonly svc: SegmentationService) {}

  @Get('api/cases/:caseId/segmentation/jobs')
  list(@Req() req: any, @Param('caseId') caseId: string) {
    return this.svc.listJobs(caseId, req.user.organizationId);
  }

  @Post('api/cases/:caseId/segmentation/jobs')
  submit(@Req() req: any, @Param('caseId') caseId: string, @Body() dto: CreateJobDto) {
    return this.svc.submitJob(caseId, req.user.organizationId, req.user.sub, dto);
  }

  @Get('api/cases/:caseId/segmentation/jobs/:jobId')
  getJob(@Req() req: any, @Param('caseId') caseId: string, @Param('jobId') jobId: string) {
    return this.svc.getJob(caseId, req.user.organizationId, jobId);
  }

  @Post('api/cases/:caseId/segmentation/jobs/:jobId/corrections')
  correct(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
    @Body() dto: CorrectionDto,
  ) {
    return this.svc.applyCorrection(caseId, req.user.organizationId, req.user.sub, jobId, dto);
  }

  @Patch('api/cases/:caseId/segmentation/jobs/:jobId/segments/:toothNumber')
  updateSegment(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
    @Param('toothNumber') toothNumber: string,
    @Body() patch: { isLocked?: boolean; isMissing?: boolean },
  ) {
    return this.svc.updateSegment(caseId, req.user.organizationId, jobId, parseInt(toothNumber, 10), patch);
  }
}
