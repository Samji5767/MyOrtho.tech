import {
  Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import {
  SegmentationService,
  type CreateJobDto,
  type CorrectionDto,
  type MaskEditDto,
  type MaskRegionType,
} from './segmentation.service';
import { AutoCorrectionService } from './auto-correction.service';

@Controller()
@UseGuards(AuthGuard)
export class SegmentationController {
  constructor(
    private readonly svc: SegmentationService,
    private readonly autoSvc: AutoCorrectionService,
  ) {}

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

  // ── Phase 24: Mask editing ─────────────────────────────────────────────────

  @Get('api/cases/:caseId/segmentation/jobs/:jobId/masks/:toothNumber')
  getMask(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
    @Param('toothNumber') toothNumber: string,
    @Query('regionType') regionType: MaskRegionType,
  ) {
    return this.svc.getMask(caseId, req.user.organizationId, jobId, parseInt(toothNumber, 10), regionType);
  }

  @Post('api/cases/:caseId/segmentation/jobs/:jobId/masks')
  editMask(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
    @Body() dto: MaskEditDto,
  ) {
    return this.svc.applyMaskEdit(caseId, req.user.organizationId, req.user.sub, jobId, dto);
  }

  @Post('api/cases/:caseId/segmentation/jobs/:jobId/undo')
  undoMask(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.svc.undoMaskEdit(caseId, req.user.organizationId, jobId);
  }

  @Post('api/cases/:caseId/segmentation/jobs/:jobId/redo')
  redoMask(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.svc.redoMaskEdit(caseId, req.user.organizationId, jobId);
  }

  @Get('api/cases/:caseId/segmentation/jobs/:jobId/history')
  getHistory(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.svc.getHistoryStack(caseId, req.user.organizationId, jobId);
  }

  @Get('api/cases/:caseId/segmentation/jobs/:jobId/heatmap')
  getHeatmap(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.svc.getConfidenceHeatmap(caseId, req.user.organizationId, jobId);
  }

  // ── Phase 25: Automatic Segmentation Correction ────────────────────────────

  @Post('api/cases/:caseId/segmentation/jobs/:jobId/analyze')
  analyzeJob(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.autoSvc.analyzeJob(caseId, req.user.organizationId, jobId, req.user.sub);
  }

  @Get('api/cases/:caseId/segmentation/jobs/:jobId/corrections/report')
  getCorrectionReport(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.autoSvc.getReport(caseId, req.user.organizationId, jobId);
  }

  @Post('api/cases/:caseId/segmentation/jobs/:jobId/corrections/items/:itemId/repair')
  repairItem(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.autoSvc.repairItem(caseId, req.user.organizationId, req.user.sub, jobId, itemId);
  }

  @Post('api/cases/:caseId/segmentation/jobs/:jobId/corrections/repair-all')
  repairAll(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.autoSvc.repairAll(caseId, req.user.organizationId, req.user.sub, jobId);
  }
}
