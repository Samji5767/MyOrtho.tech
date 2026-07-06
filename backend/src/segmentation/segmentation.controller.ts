import {
  Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import {
  SegmentationService,
  type CreateJobDto,
  type CorrectionDto,
  type MaskEditDto,
  type MaskRegionType,
} from './segmentation.service';
import { AutoCorrectionService } from './auto-correction.service';

interface AuthUser { id: string; orgId: string | null; role: string }

function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller()
@UseGuards(AuthGuard)
export class SegmentationController {
  constructor(
    private readonly svc: SegmentationService,
    private readonly autoSvc: AutoCorrectionService,
  ) {}

  @Get('api/cases/:caseId/segmentation/jobs')
  list(@Req() req: Request, @Param('caseId') caseId: string) {
    const { orgId } = getUser(req);
    return this.svc.listJobs(caseId, orgId);
  }

  @Post('api/cases/:caseId/segmentation/jobs')
  submit(@Req() req: Request, @Param('caseId') caseId: string, @Body() dto: CreateJobDto) {
    const { id, orgId } = getUser(req);
    return this.svc.submitJob(caseId, orgId, id, dto);
  }

  @Get('api/cases/:caseId/segmentation/jobs/:jobId')
  getJob(@Req() req: Request, @Param('caseId') caseId: string, @Param('jobId') jobId: string) {
    const { orgId } = getUser(req);
    return this.svc.getJob(caseId, orgId, jobId);
  }

  @Delete('api/cases/:caseId/segmentation/jobs/:jobId')
  @HttpCode(200)
  cancelJob(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
    @Body() body: { reason?: string },
  ) {
    const { orgId } = getUser(req);
    return this.svc.cancelJob(caseId, orgId, jobId, body?.reason);
  }

  @Post('api/cases/:caseId/segmentation/jobs/:jobId/corrections')
  correct(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
    @Body() dto: CorrectionDto,
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.applyCorrection(caseId, orgId, id, jobId, dto);
  }

  @Patch('api/cases/:caseId/segmentation/jobs/:jobId/segments/:toothNumber')
  updateSegment(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
    @Param('toothNumber') toothNumber: string,
    @Body() patch: { isLocked?: boolean; isMissing?: boolean },
  ) {
    const { orgId } = getUser(req);
    return this.svc.updateSegment(caseId, orgId, jobId, parseInt(toothNumber, 10), patch);
  }

  // ── Phase 24: Mask editing ─────────────────────────────────────────────────

  @Get('api/cases/:caseId/segmentation/jobs/:jobId/masks/:toothNumber')
  getMask(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
    @Param('toothNumber') toothNumber: string,
    @Query('regionType') regionType: MaskRegionType,
  ) {
    const { orgId } = getUser(req);
    return this.svc.getMask(caseId, orgId, jobId, parseInt(toothNumber, 10), regionType);
  }

  @Post('api/cases/:caseId/segmentation/jobs/:jobId/masks')
  editMask(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
    @Body() dto: MaskEditDto,
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.applyMaskEdit(caseId, orgId, id, jobId, dto);
  }

  @Post('api/cases/:caseId/segmentation/jobs/:jobId/undo')
  undoMask(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
  ) {
    const { orgId } = getUser(req);
    return this.svc.undoMaskEdit(caseId, orgId, jobId);
  }

  @Post('api/cases/:caseId/segmentation/jobs/:jobId/redo')
  redoMask(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
  ) {
    const { orgId } = getUser(req);
    return this.svc.redoMaskEdit(caseId, orgId, jobId);
  }

  @Get('api/cases/:caseId/segmentation/jobs/:jobId/history')
  getHistory(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
  ) {
    const { orgId } = getUser(req);
    return this.svc.getHistoryStack(caseId, orgId, jobId);
  }

  @Get('api/cases/:caseId/segmentation/jobs/:jobId/heatmap')
  getHeatmap(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
  ) {
    const { orgId } = getUser(req);
    return this.svc.getConfidenceHeatmap(caseId, orgId, jobId);
  }

  // ── Phase 25: Automatic Segmentation Correction ────────────────────────────

  @Post('api/cases/:caseId/segmentation/jobs/:jobId/analyze')
  analyzeJob(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
  ) {
    const { id, orgId } = getUser(req);
    return this.autoSvc.analyzeJob(caseId, orgId, jobId, id);
  }

  @Get('api/cases/:caseId/segmentation/jobs/:jobId/corrections/report')
  getCorrectionReport(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
  ) {
    const { orgId } = getUser(req);
    return this.autoSvc.getReport(caseId, orgId, jobId);
  }

  @Post('api/cases/:caseId/segmentation/jobs/:jobId/corrections/items/:itemId/repair')
  repairItem(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
    @Param('itemId') itemId: string,
  ) {
    const { id, orgId } = getUser(req);
    return this.autoSvc.repairItem(caseId, orgId, id, jobId, itemId);
  }

  @Post('api/cases/:caseId/segmentation/jobs/:jobId/corrections/repair-all')
  repairAll(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
  ) {
    const { id, orgId } = getUser(req);
    return this.autoSvc.repairAll(caseId, orgId, id, jobId);
  }
}
