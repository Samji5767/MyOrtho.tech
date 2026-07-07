import {
  Controller, Get, Post, Delete, Patch, Param, Body, UseGuards, Request,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { StagesService, CreateStageDto, GenerateStagesDto } from './stages.service';
import type { AuthenticatedRequest } from '../common/auth-request.type';

@Controller('api/cases/:caseId/plans/:planId/stages')
@UseGuards(AuthGuard)
export class StagesController {
  constructor(private readonly stages: StagesService) {}

  @Get()
  list(
    @Param('planId') planId: string,
    @Param('caseId') caseId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.stages.list(planId, caseId, req.user.orgId);
  }

  @Post()
  create(
    @Param('planId') planId: string,
    @Param('caseId') caseId: string,
    @Body() dto: CreateStageDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.stages.create(planId, caseId, req.user.orgId, dto);
  }

  @Post('generate')
  generate(
    @Param('planId') planId: string,
    @Param('caseId') caseId: string,
    @Body() dto: GenerateStagesDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.stages.generate(planId, caseId, req.user.orgId, dto);
  }

  @Patch(':stageId/approve')
  approve(
    @Param('planId') planId: string,
    @Param('caseId') caseId: string,
    @Param('stageId') stageId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.stages.approve(planId, caseId, req.user.orgId, stageId, req.user.id);
  }

  @Delete(':stageId')
  delete(
    @Param('planId') planId: string,
    @Param('caseId') caseId: string,
    @Param('stageId') stageId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.stages.delete(planId, caseId, req.user.orgId, stageId);
  }
}
