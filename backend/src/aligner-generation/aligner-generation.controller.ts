import {
  Body, Controller, Get, Param, Post, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AlignerGenerationService, type GenerateDto } from './aligner-generation.service';

@Controller()
@UseGuards(AuthGuard)
export class AlignerGenerationController {
  constructor(private readonly svc: AlignerGenerationService) {}

  @Post('api/cases/:caseId/plans/:planId/aligner-generation/generate')
  generate(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Body() dto: GenerateDto,
  ) {
    return this.svc.generate(caseId, req.user.orgId, req.user.id, planId, dto);
  }

  @Get('api/cases/:caseId/plans/:planId/aligner-generation/plan')
  getPlan(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.getPlan(caseId, req.user.orgId, planId);
  }

  @Get('api/cases/:caseId/plans/:planId/aligner-generation/stages/:stageNum')
  getStageAllocations(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Param('stageNum') stageNum: string,
  ) {
    return this.svc.getStageAllocations(caseId, req.user.orgId, planId, parseInt(stageNum, 10));
  }

  @Post('api/cases/:caseId/plans/:planId/aligner-generation/approve')
  approve(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Body() body: { notes?: string },
  ) {
    return this.svc.approvePlan(caseId, req.user.orgId, req.user.id, planId, body.notes);
  }

  @Post('api/cases/:caseId/plans/:planId/aligner-generation/stl-ready')
  markStlReady(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Body() body: { exportPath: string },
  ) {
    return this.svc.markStlReady(caseId, req.user.orgId, planId, body.exportPath);
  }
}
