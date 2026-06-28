import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { BiomechanicsService } from './biomechanics.service';

@Controller('api/cases/:caseId/plans/:planId/biomechanics')
@UseGuards(AuthGuard)
export class BiomechanicsController {
  constructor(private readonly svc: BiomechanicsService) {}

  @Get()
  getAssessment(@Param('planId') planId: string, @Param('caseId') caseId: string, @Request() req: any) {
    return this.svc.getAssessment(planId, caseId, req.user.orgId as string);
  }

  @Post('assess')
  assessPlan(@Param('planId') planId: string, @Param('caseId') caseId: string, @Request() req: any) {
    return this.svc.assessPlan(planId, caseId, req.user.orgId as string);
  }
}
