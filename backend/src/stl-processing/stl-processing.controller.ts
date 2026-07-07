import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as path from 'path';
import * as fs from 'fs';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { StlProcessingService, ValidateScanDto } from './stl-processing.service';

const ARCH_TYPE_MAP: Record<string, string> = {
  upper: 'maxillary',
  lower: 'mandibular',
  bite: 'bite_registration',
};

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
  @UseInterceptors(FileInterceptor('file'))
  async createUpload(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { fileName?: string; archType?: string; caseId?: string; patientId?: string },
  ) {
    const { id, orgId } = getUser(req);

    const fileName = body.fileName ?? file?.originalname ?? 'upload.stl';
    const rawArchType = body.archType ?? 'unknown';
    const archType = ARCH_TYPE_MAP[rawArchType] ?? rawArchType;

    let storagePath = '';
    if (file) {
      const uploadsDir = process.env.UPLOADS_DIR ?? '/app/uploads';
      const destDir = path.join(uploadsDir, 'stl', orgId);
      fs.mkdirSync(destDir, { recursive: true });
      const destPath = path.join(destDir, `${Date.now()}_${fileName}`);
      fs.renameSync(file.path, destPath);
      storagePath = destPath;
    }

    return this.svc.createUpload(orgId, id, {
      caseId: body.caseId,
      patientId: body.patientId,
      fileName,
      fileSizeBytes: file?.size,
      storagePath,
      archType,
    });
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
