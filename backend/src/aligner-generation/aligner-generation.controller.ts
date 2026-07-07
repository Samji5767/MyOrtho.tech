import * as fs from 'fs';
import {
  Body, Controller, Get, Param, Post, Req, Res, StreamableFile, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AlignerGenerationService, type GenerateDto } from './aligner-generation.service';
import type { AuthenticatedRequest } from '../common/auth-request.type';


@Controller()
@UseGuards(AuthGuard)
export class AlignerGenerationController {
  constructor(private readonly svc: AlignerGenerationService) {}

  @Get('api/cases/:caseId/plans/:planId/aligner-generation/quality-report')
  getQualityReport(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') _caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.validatePlan(planId, req.user.orgId);
  }

  @Post('api/cases/:caseId/plans/:planId/aligner-generation/generate')
  generate(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Body() dto: GenerateDto,
  ) {
    return this.svc.generate(caseId, req.user.orgId, req.user.id, planId, dto);
  }

  @Get('api/cases/:caseId/plans/:planId/aligner-generation/plan')
  getPlan(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.getPlan(caseId, req.user.orgId, planId);
  }

  @Get('api/cases/:caseId/plans/:planId/aligner-generation/stages/:stageNum')
  getStageAllocations(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Param('stageNum') stageNum: string,
  ) {
    return this.svc.getStageAllocations(caseId, req.user.orgId, planId, parseInt(stageNum, 10));
  }

  @Get('api/cases/:caseId/plans/:planId/aligner-generation/stl-export')
  async getStlExport(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') _caseId: string,
    @Param('planId') planId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { filePath, planId: pid } = await this.svc.getStlFile(planId, req.user.orgId);
    res.setHeader('Content-Disposition', `attachment; filename="aligner-plan-${pid}.stl"`);
    res.setHeader('Content-Type', 'model/stl');
    res.setHeader('Cache-Control', 'private, no-cache');
    return new StreamableFile(fs.createReadStream(filePath));
  }

  @Post('api/cases/:caseId/plans/:planId/aligner-generation/approve')
  approve(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Body() body: { notes?: string },
  ) {
    return this.svc.approvePlan(caseId, req.user.orgId, req.user.id, planId, body.notes);
  }

  @Post('api/cases/:caseId/plans/:planId/aligner-generation/stl-ready')
  markStlReady(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Body() body: { exportPath: string },
  ) {
    return this.svc.markStlReady(caseId, req.user.orgId, planId, body.exportPath);
  }

  @Post('api/cases/:caseId/plans/:planId/aligner-generation/generate-stl')
  generateStl(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.generateStl(caseId, req.user.orgId, planId);
  }
}
