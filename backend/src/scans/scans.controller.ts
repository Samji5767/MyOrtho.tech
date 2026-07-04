import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import type { Request, Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
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
@UseGuards(AuthGuard, PermissionsGuard)
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  /** List all scans for a case. */
  @Get()
  listScans(@Req() req: Request, @Param('caseId') caseId: string) {
    const user = getUser(req);
    return this.scansService.findByCaseId(caseId, user.orgId!);
  }

  /**
   * Upload a scan (STL / OBJ / PLY, max 500 MB).
   * Multipart field: file=<binary>, jawType=maxillary|mandibular|both
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('cases:write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } }))
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

  /** Stream the raw scan file (STL/OBJ/PLY) — authenticated, org-scoped. */
  @Get(':scanId/file')
  async getScanFile(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('caseId') caseId: string,
    @Param('scanId') scanId: string,
  ): Promise<StreamableFile> {
    const user = getUser(req);
    const { filePath, originalFilename, fileFormat } =
      await this.scansService.getScanFile(caseId, scanId, user.orgId!);
    const mime =
      fileFormat === 'stl' ? 'model/stl' :
      fileFormat === 'obj' ? 'model/obj' :
      'application/octet-stream';
    res.setHeader('Content-Disposition', `inline; filename="${originalFilename}"`);
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return new StreamableFile(fs.createReadStream(filePath));
  }

  /** List all persisted segmentation jobs for a case (survives backend restart). */
  @Get('segmentation-jobs')
  listSegmentationJobs(@Req() req: Request, @Param('caseId') caseId: string) {
    const user = getUser(req);
    return this.scansService.listJobsForCase(caseId, user.orgId!);
  }
}

/** Polls AI-engine segmentation job status (by job ID). */
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

  /** Retry a failed segmentation job. */
  @Post(':jobId/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  retryJob(@Req() req: Request, @Param('jobId') jobId: string) {
    const user = (req as Request & { user?: AuthUser }).user;
    if (!user?.orgId) throw new UnauthorizedException();
    return this.scansService.retryJob(jobId, user.orgId, user.email ?? 'unknown');
  }
}
