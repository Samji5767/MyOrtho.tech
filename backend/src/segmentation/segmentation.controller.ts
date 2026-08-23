import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post, Query, Req, Res, StreamableFile, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import {
  SegmentationService,
  type CreateJobDto,
  type CorrectionDto,
  type MaskEditDto,
  type MaskRegionType,
  type ReviewDecision,
} from './segmentation.service';
import { AutoCorrectionService } from './auto-correction.service';

interface AuthUser { id: string; orgId: string | null; role: string; email?: string }

function getUser(req: Request): { id: string; orgId: string; email?: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId, email: u.email };
}

@Controller()
@UseGuards(AuthGuard, PermissionsGuard)
export class SegmentationController {
  constructor(
    private readonly svc: SegmentationService,
    private readonly autoSvc: AutoCorrectionService,
  ) {}

  @Get('api/cases/:caseId/segmentation/jobs')
  @RequirePermission('cases:read')
  list(@Req() req: Request, @Param('caseId') caseId: string) {
    const { orgId } = getUser(req);
    return this.svc.listJobs(caseId, orgId);
  }

  @Post('api/cases/:caseId/segmentation/jobs')
  @RequirePermission('cases:write')
  submit(@Req() req: Request, @Param('caseId') caseId: string, @Body() dto: CreateJobDto) {
    const { id, orgId } = getUser(req);
    return this.svc.submitJob(caseId, orgId, id, dto);
  }

  @Get('api/cases/:caseId/segmentation/jobs/:jobId')
  @RequirePermission('cases:read')
  getJob(@Req() req: Request, @Param('caseId') caseId: string, @Param('jobId') jobId: string) {
    const { orgId } = getUser(req);
    return this.svc.getJob(caseId, orgId, jobId);
  }

  @Delete('api/cases/:caseId/segmentation/jobs/:jobId')
  @RequirePermission('cases:write')
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
  @RequirePermission('cases:write')
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
  @RequirePermission('cases:write')
  updateSegment(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
    @Param('toothNumber') toothNumber: string,
    @Body() patch: { isLocked?: boolean; isMissing?: boolean; newToothNumber?: number },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.updateSegment(caseId, orgId, jobId, parseInt(toothNumber, 10), patch, id);
  }

  /**
   * Clinical sign-off on a segmentation result. Requires approval authority
   * (same permission tier as treatment-plan approval). Records reviewer,
   * decision, and note; audit-logged.
   *
   * POST /api/cases/:caseId/segmentation/jobs/:jobId/review
   */
  @Post('api/cases/:caseId/segmentation/jobs/:jobId/review')
  @RequirePermission('cases:approve')
  review(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
    @Body() body: { decision: ReviewDecision; note?: string },
  ) {
    const { id, orgId, email } = getUser(req);
    return this.svc.reviewJob(caseId, orgId, id, jobId, body?.decision, body?.note, email);
  }

  // ── Phase 24: Mask editing ─────────────────────────────────────────────────

  @Get('api/cases/:caseId/segmentation/jobs/:jobId/masks/:toothNumber')
  @RequirePermission('cases:read')
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
  @RequirePermission('cases:write')
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
  @RequirePermission('cases:write')
  undoMask(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
  ) {
    const { orgId } = getUser(req);
    return this.svc.undoMaskEdit(caseId, orgId, jobId);
  }

  @Post('api/cases/:caseId/segmentation/jobs/:jobId/redo')
  @RequirePermission('cases:write')
  redoMask(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
  ) {
    const { orgId } = getUser(req);
    return this.svc.redoMaskEdit(caseId, orgId, jobId);
  }

  @Get('api/cases/:caseId/segmentation/jobs/:jobId/history')
  @RequirePermission('cases:read')
  getHistory(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
  ) {
    const { orgId } = getUser(req);
    return this.svc.getHistoryStack(caseId, orgId, jobId);
  }

  @Get('api/cases/:caseId/segmentation/jobs/:jobId/heatmap')
  @RequirePermission('cases:read')
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
  @RequirePermission('cases:write')
  analyzeJob(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
  ) {
    const { id, orgId } = getUser(req);
    return this.autoSvc.analyzeJob(caseId, orgId, jobId, id);
  }

  @Get('api/cases/:caseId/segmentation/jobs/:jobId/corrections/report')
  @RequirePermission('cases:read')
  getCorrectionReport(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
  ) {
    const { orgId } = getUser(req);
    return this.autoSvc.getReport(caseId, orgId, jobId);
  }

  @Post('api/cases/:caseId/segmentation/jobs/:jobId/corrections/items/:itemId/repair')
  @RequirePermission('cases:write')
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
  @RequirePermission('cases:write')
  repairAll(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
  ) {
    const { id, orgId } = getUser(req);
    return this.autoSvc.repairAll(caseId, orgId, id, jobId);
  }

  /**
   * Stream the per-tooth STL mesh file produced by AI segmentation.
   * Authentication + org scope enforced: the job must belong to a case that
   * belongs to the authenticated user's organization.
   *
   * GET /api/cases/:caseId/segmentation/jobs/:jobId/segments/:toothNumber/mesh
   */
  @Get('api/cases/:caseId/segmentation/jobs/:jobId/segments/:toothNumber/mesh')
  @RequirePermission('cases:read')
  async getToothMesh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
    @Param('toothNumber') toothNumberStr: string,
  ): Promise<StreamableFile> {
    const { orgId } = getUser(req);
    const toothNumber = parseInt(toothNumberStr, 10);
    if (!Number.isFinite(toothNumber)) {
      throw new BadRequestException('Invalid tooth number');
    }
    const meshPath = await this.svc.getToothMeshPath(caseId, orgId, jobId, toothNumber);
    if (!meshPath || !fs.existsSync(meshPath)) {
      throw new NotFoundException('Tooth mesh not found');
    }
    res.setHeader('Content-Type', 'model/stl');
    res.setHeader('Content-Disposition', `inline; filename="tooth_fdi_${toothNumber}.stl"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return new StreamableFile(fs.createReadStream(meshPath));
  }

  /**
   * Stream the gingiva STL mesh file from the segmentation output directory.
   * GET /api/cases/:caseId/segmentation/jobs/:jobId/gingiva/mesh
   */
  @Get('api/cases/:caseId/segmentation/jobs/:jobId/gingiva/mesh')
  @RequirePermission('cases:read')
  async getGingivaMesh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('caseId') caseId: string,
    @Param('jobId') jobId: string,
  ): Promise<StreamableFile> {
    const { orgId } = getUser(req);
    const meshPath = await this.svc.getGingivaMeshPath(caseId, orgId, jobId);
    if (!meshPath || !fs.existsSync(meshPath)) {
      throw new NotFoundException('Gingiva mesh not found');
    }
    res.setHeader('Content-Type', 'model/stl');
    res.setHeader('Content-Disposition', `inline; filename="gingiva.stl"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return new StreamableFile(fs.createReadStream(meshPath));
  }
}
