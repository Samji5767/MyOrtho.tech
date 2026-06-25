import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { TreatmentPlansService } from './treatment-plans.service';

class CreatePlanBody {
  @IsOptional() @IsNumber() @Min(1)
  estimatedStages?: number;

  @IsOptional() @IsString()
  aiRecommendationNotes?: string;

  @IsOptional() @IsObject()
  iprDetails?: Record<string, unknown>;
}

class ApprovePlanBody {
  @IsString()
  signature: string;
}

class CreateStageBody {
  @IsNumber() @Min(1)
  stageNumber: number;

  @IsOptional() @IsString()
  maxillaryMeshPath?: string;

  @IsOptional() @IsString()
  mandibularMeshPath?: string;

  @IsOptional() @IsObject()
  movements?: Record<string, unknown>;
}

interface AuthUser {
  id: string;
  email: string;
  orgId: string | null;
}

function auth(req: Request): AuthUser {
  const user = (req as Request & { user?: AuthUser }).user;
  if (!user?.orgId) throw new UnauthorizedException('No organization context');
  return user;
}

@Controller('api/cases/:caseId/plans')
@UseGuards(AuthGuard)
export class TreatmentPlansController {
  constructor(private readonly service: TreatmentPlansService) {}

  @Get()
  listPlans(@Req() req: Request, @Param('caseId') caseId: string) {
    const user = auth(req);
    return this.service.listPlans(caseId, user.orgId!);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createPlan(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() body: CreatePlanBody,
  ) {
    const user = auth(req);
    return this.service.createPlan(caseId, user.orgId!, user.id, body);
  }

  @Get(':planId')
  getPlan(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    const user = auth(req);
    return this.service.getPlan(planId, caseId, user.orgId!);
  }

  /** Doctor approval — sets doctor_approval = true and advances case status. */
  @Post(':planId/approve')
  @HttpCode(HttpStatus.OK)
  approvePlan(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Body() body: ApprovePlanBody,
  ) {
    const user = auth(req);
    return this.service.approvePlan(planId, caseId, user.orgId!, user.id, body.signature);
  }

  @Get(':planId/stages')
  listStages(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    const user = auth(req);
    return this.service.listStages(planId, caseId, user.orgId!);
  }

  @Post(':planId/stages')
  @HttpCode(HttpStatus.CREATED)
  createStage(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Body() body: CreateStageBody,
  ) {
    const user = auth(req);
    return this.service.createStage(planId, caseId, user.orgId!, body);
  }
}
