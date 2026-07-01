import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import {
  TreatmentGoalsService,
  type GenerateGoalsDto,
  type UpdateGoalDto,
} from './treatment-goals.service';

interface AuthUser {
  id: string;
  email: string;
  role: string;
  name: string;
  orgId: string | null;
}

function getUser(req: Request): AuthUser {
  const user = (req as Request & { user?: AuthUser }).user;
  if (!user) throw new UnauthorizedException('No session');
  return user;
}

function requireOrgId(user: AuthUser): string {
  if (!user.orgId) throw new UnauthorizedException('Organization context required');
  return user.orgId;
}

@Controller('api/treatment-goals')
@UseGuards(AuthGuard)
export class TreatmentGoalsController {
  constructor(private readonly svc: TreatmentGoalsService) {}

  @Post('generate')
  generate(
    @Req() req: Request,
    @Body() body: {
      caseId: string;
      clinicalAnalysisId?: string;
      crowdingUpper?: number;
      crowdingLower?: number;
      boltonDiscrepancy?: number;
      overjet?: number;
      overbite?: number;
      angleClass?: string;
      archForm?: string;
    },
  ) {
    const user   = getUser(req);
    const orgId  = requireOrgId(user);
    if (!body.caseId) throw new BadRequestException('caseId is required');
    const dto: GenerateGoalsDto = {
      caseId: body.caseId,
      clinicalAnalysisId: body.clinicalAnalysisId,
      crowdingUpper: body.crowdingUpper,
      crowdingLower: body.crowdingLower,
      boltonDiscrepancy: body.boltonDiscrepancy,
      overjet: body.overjet,
      overbite: body.overbite,
      angleClass: body.angleClass,
      archForm: body.archForm,
    };
    return this.svc.generateGoals(orgId, dto);
  }

  @Get()
  list(@Req() req: Request, @Query('caseId') caseId: string) {
    const user  = getUser(req);
    const orgId = requireOrgId(user);
    if (!caseId) throw new BadRequestException('caseId query param is required');
    return this.svc.listGoals(orgId, caseId);
  }

  @Get(':id')
  getOne(@Req() req: Request, @Param('id') id: string) {
    const user  = getUser(req);
    const orgId = requireOrgId(user);
    return this.svc.getGoal(orgId, id);
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdateGoalDto,
  ) {
    const user  = getUser(req);
    const orgId = requireOrgId(user);
    return this.svc.updateGoal(orgId, id, body);
  }

  @Post(':id/approve')
  approve(@Req() req: Request, @Param('id') id: string) {
    const user  = getUser(req);
    const orgId = requireOrgId(user);
    return this.svc.approveGoal(orgId, id, user.id);
  }
}
