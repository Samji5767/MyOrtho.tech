import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Req,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { ScansService } from './scans.service';

interface AuthUser {
  id: string;
  email: string;
  role: string;
  orgId: string | null;
}

function getUser(req: Request): AuthUser {
  const user = (req as Request & { user?: AuthUser }).user;
  if (!user) throw new UnauthorizedException('Authentication required');
  if (!user.orgId) throw new UnauthorizedException('No organization context');
  return user;
}

@Controller('api/cases/:caseId/scans')
@UseGuards(AuthGuard)
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  /** List all scans for a case. */
  @Get()
  listScans(@Req() req: Request, @Param('caseId') caseId: string) {
    const user = getUser(req);
    return this.scansService.findByCaseId(caseId, user.orgId!);
  }

  /**
   * Upload a scan (STL / OBJ / PLY, max 250 MB).
   * Multipart field: file=<binary>, jawType=maxillary|mandibular|both
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  uploadScan(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Multipart field "file" is required');
    const user = getUser(req);
    const jawType = (req.body as { jawType?: string })?.jawType ?? 'maxillary';
    return this.scansService.create(caseId, user.orgId!, user.id, file, jawType, user.email);
  }

  /**
   * Trigger AI segmentation for a specific scan.
   * Returns a jobId to poll via GET /api/segment-jobs/:jobId
   * Disclaimer: AI engine output is NOT clinically validated.
   */
  @Post(':scanId/segment')
  @HttpCode(HttpStatus.ACCEPTED)
  triggerSegmentation(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('scanId') scanId: string,
  ) {
    const user = getUser(req);
    return this.scansService.triggerSegmentation(caseId, scanId, user.orgId!, user.email);
  }
}

/** Polls AI-engine segmentation job status. */
@Controller('api/segment-jobs')
@UseGuards(AuthGuard)
export class SegmentJobsController {
  constructor(private readonly scansService: ScansService) {}

  @Get(':jobId')
  getJobStatus(@Req() req: Request, @Param('jobId') jobId: string) {
    const user = (req as Request & { user?: AuthUser }).user;
    if (!user?.orgId) throw new UnauthorizedException();
    return this.scansService.getJobStatus(jobId, user.orgId);
  }
}
