import {
  Controller,
  Get,
  Patch,
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
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
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

class UpdatePlanBody {
  @IsOptional() @IsNumber() @Min(1)
  estimatedStages?: number;

  @IsOptional() @IsString()
  aiRecommendationNotes?: string;
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
@UseGuards(AuthGuard, PermissionsGuard)
export class TreatmentPlansController {
  constructor(private readonly service: TreatmentPlansService) {}

  @Get()
  @RequirePermission('cases:read')
  listPlans(@Req() req: Request, @Param('caseId') caseId: string) {
    const user = auth(req);
    return this.service.listPlans(caseId, user.orgId!);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('cases:write')
  createPlan(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() body: CreatePlanBody,
  ) {
    const user = auth(req);
    return this.service.createPlan(caseId, user.orgId!, user.id, body);
  }

  @Get(':planId')
  @RequirePermission('cases:read')
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
  @RequirePermission('cases:approve')
  approvePlan(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Body() body: ApprovePlanBody,
  ) {
    const user = auth(req);
    return this.service.approvePlan(planId, caseId, user.orgId!, user.id, body.signature);
  }

  @Patch(':planId')
  @RequirePermission('cases:write')
  updatePlan(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Body() body: UpdatePlanBody,
  ) {
    const user = auth(req);
    return this.service.updatePlan(planId, caseId, user.orgId!, body);
  }

  @Post(':planId/stages/generate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('cases:write')
  generateStages(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Body() body: { stageCount?: number },
  ) {
    const user = auth(req);
    return this.service.generateStages(planId, caseId, user.orgId!, body.stageCount);
  }

  @Post(':planId/stages/bulk')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('cases:write')
  bulkUpsertStages(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Body() body: { stages: CreateStageBody[] },
  ) {
    const user = auth(req);
    return this.service.bulkUpsertStages(planId, caseId, user.orgId!, body.stages);
  }

  @Get(':planId/stages')
  @RequirePermission('cases:read')
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
  @RequirePermission('cases:write')
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
