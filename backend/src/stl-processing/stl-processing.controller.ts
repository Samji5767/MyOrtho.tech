import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { StlProcessingService, CreateUploadDto, ValidateScanDto } from './stl-processing.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/stl')
@UseGuards(AuthGuard)
export class StlProcessingController {
  constructor(private readonly svc: StlProcessingService) {}

  @Post('uploads')
  createUpload(
    @Req() req: Request,
    @Body() body: CreateUploadDto,
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.createUpload(orgId, id, body);
  }

  @Get('uploads')
  listUploads(
    @Req() req: Request,
    @Query('caseId') caseId: string,
  ) {
    const { orgId } = getUser(req);
    return this.svc.listUploads(orgId, caseId);
  }

  @Post('uploads/:id/validate')
  validateScan(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: ValidateScanDto,
  ) {
    const { orgId } = getUser(req);
    return this.svc.validateScan(orgId, id, body);
  }

  @Post('uploads/:id/process')
  processScan(
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const { orgId } = getUser(req);
    return this.svc.processScan(orgId, id);
  }

  @Get('pipeline/:caseId')
  getPipeline(
    @Req() req: Request,
    @Param('caseId') caseId: string,
  ) {
    const { orgId } = getUser(req);
    return this.svc.getPipeline(orgId, caseId);
  }

  @Post('pipeline/:caseId')
  upsertPipeline(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() body: { uploadId: string },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.upsertPipeline(orgId, caseId, id, body.uploadId);
  }

  @Post('pipeline/:caseId/advance')
  advancePipeline(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() body: { currentStep: number; summary?: string },
  ) {
    const { orgId } = getUser(req);
    const step = body.currentStep ?? 1;
    const summary = body.summary ?? `Step ${step} completed`;
    return this.svc.advancePipelineStep(orgId, caseId, step, `step_${step}`, JSON.stringify({ status: 'completed', summary }));
  }
}
