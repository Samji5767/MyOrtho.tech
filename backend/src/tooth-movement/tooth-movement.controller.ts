import {
  Body, Controller, Delete, Get, Param, Post, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import {
  ToothMovementService,
  type MovementPrescriptionDto,
} from './tooth-movement.service';

// Re-export types so consumers can import from the controller module path
export type {
  EnhancedCollisionPair,
  RootSafetyResult,
  DifficultyScoreBreakdown,
  ToothForceData,
  MovementConflict,
  OvercorrectionSuggestion,
  RefinementRecommendation,
  ApprovalValidation,
} from './tooth-movement.service';

@Controller()
@UseGuards(AuthGuard)
export class ToothMovementController {
  constructor(private readonly svc: ToothMovementService) {}

  @Post('api/cases/:caseId/plans/:planId/movements/prescriptions')
  upsertPrescription(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Body() dto: MovementPrescriptionDto,
  ) {
    return this.svc.upsertPrescription(caseId, req.user.orgId, req.user.id, planId, dto);
  }

  @Get('api/cases/:caseId/plans/:planId/movements/prescriptions')
  listPrescriptions(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.listPrescriptions(caseId, req.user.orgId, planId);
  }

  @Delete('api/cases/:caseId/plans/:planId/movements/prescriptions/:fdi')
  deletePrescription(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Param('fdi') fdi: string,
  ) {
    return this.svc.deletePrescription(caseId, req.user.orgId, planId, parseInt(fdi, 10));
  }

  @Post('api/cases/:caseId/plans/:planId/movements/approve')
  approvePrescriptions(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.approvePrescriptions(caseId, req.user.orgId, req.user.id, planId);
  }

  @Post('api/cases/:caseId/plans/:planId/movements/simulate')
  simulate(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.simulate(caseId, req.user.orgId, req.user.id, planId);
  }

  @Get('api/cases/:caseId/plans/:planId/movements/simulation')
  getSimulation(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.getSimulation(caseId, req.user.orgId, planId);
  }

  @Get('api/cases/:caseId/plans/:planId/movements/pdl/:stageNum')
  getPdlResults(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Param('stageNum') stageNum: string,
  ) {
    return this.svc.getPdlResults(caseId, req.user.orgId, planId, parseInt(stageNum, 10));
  }

  @Get('api/cases/:caseId/plans/:planId/movements/constraints')
  getConstraints(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.getConstraintViolations(caseId, req.user.orgId, planId);
  }

  // ── Clinical Analysis endpoints ──────────────────────────────────────────

  @Get('api/cases/:caseId/plans/:planId/movements/collisions')
  getEnhancedCollisions(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.getEnhancedCollisions(caseId, req.user.orgId, planId);
  }

  @Get('api/cases/:caseId/plans/:planId/movements/root-safety')
  getRootSafety(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.getRootSafetyAnalysis(caseId, req.user.orgId, planId);
  }

  @Get('api/cases/:caseId/plans/:planId/movements/difficulty')
  getDifficulty(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.getDifficultyScore(caseId, req.user.orgId, planId);
  }

  @Get('api/cases/:caseId/plans/:planId/movements/force-heatmap')
  getForceHeatmap(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.getForceHeatmap(caseId, req.user.orgId, planId);
  }

  @Get('api/cases/:caseId/plans/:planId/movements/conflicts')
  getConflicts(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.getMovementConflicts(caseId, req.user.orgId, planId);
  }

  @Get('api/cases/:caseId/plans/:planId/movements/overcorrection-suggestions')
  getOvercorrectionSuggestions(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.getOvercorrectionSuggestions(caseId, req.user.orgId, planId);
  }

  @Get('api/cases/:caseId/plans/:planId/movements/refinement-recommendations')
  getRefinementRecommendations(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.getRefinementRecommendations(caseId, req.user.orgId, planId);
  }

  @Get('api/cases/:caseId/plans/:planId/movements/validate-approval')
  validateApproval(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.validateForApproval(caseId, req.user.orgId, planId);
  }
}
