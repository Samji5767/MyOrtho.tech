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
import { ClinicalAnalysisDeepService, GenerateAnalysisDto } from './clinical-analysis-deep.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/clinical-analysis-deep')
@UseGuards(AuthGuard)
export class ClinicalAnalysisDeepController {
  constructor(private readonly svc: ClinicalAnalysisDeepService) {}

  @Post()
  generateAnalysis(
    @Req() req: Request,
    @Body() body: GenerateAnalysisDto,
  ) {
    const { orgId } = getUser(req);
    return this.svc.generateAnalysis(orgId, body);
  }

  @Get()
  getAnalysis(
    @Req() req: Request,
    @Query('caseId') caseId: string,
  ) {
    const { orgId } = getUser(req);
    return this.svc.getAnalysis(orgId, caseId);
  }

  @Get('upload/:uploadId')
  getAnalysisByUpload(
    @Req() req: Request,
    @Param('uploadId') uploadId: string,
  ) {
    const { orgId } = getUser(req);
    return this.svc.getAnalysisByUpload(orgId, uploadId);
  }
}
