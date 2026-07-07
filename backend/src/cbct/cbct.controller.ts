import {
  Controller, Post, Get, Patch, Param, Body, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CbctService } from './cbct.service';
import type { AuthenticatedRequest } from '../common/auth-request.type';

@Controller('api/cases/:caseId/cbct')
@UseGuards(AuthGuard)
export class CbctController {
  constructor(private readonly svc: CbctService) {}

  @Post('scans')
  registerScan(
    @Param('caseId') caseId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: {
      filePath: string;
      fileFormat: 'dicom' | 'dcm_zip' | 'nifti' | 'raw';
      originalFilename?: string;
      fileSizeBytes?: number;
      voxelSizeMm?: number;
      fovMm?: number;
      kvp?: number;
      ma?: number;
      acquisitionDate?: string;
    },
  ) {
    return this.svc.registerCbctScan(caseId, req.user.orgId, req.user.id, body);
  }

  @Get('scans')
  listScans(@Param('caseId') caseId: string, @Req() req: AuthenticatedRequest) {
    return this.svc.listCbctScans(caseId, req.user.orgId);
  }

  @Post('fusions')
  createFusion(
    @Param('caseId') caseId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: {
      cbctScanId: string;
      stlScanId: string;
      registrationMethod?: 'icp' | 'surface_match' | 'landmark' | 'manual';
    },
  ) {
    return this.svc.createFusion(
      caseId, req.user.orgId, req.user.id,
      body.cbctScanId, body.stlScanId, body.registrationMethod,
    );
  }

  @Get('fusions')
  listFusions(@Param('caseId') caseId: string, @Req() req: AuthenticatedRequest) {
    return this.svc.listFusions(caseId, req.user.orgId);
  }

  @Patch('fusions/:fusionId/review')
  reviewFusion(
    @Param('caseId') caseId: string,
    @Param('fusionId') fusionId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.svc.reviewFusion(caseId, req.user.orgId, req.user.id, fusionId);
  }

  @Get('fusions/:fusionId/segments')
  listSegments(
    @Param('caseId') caseId: string,
    @Param('fusionId') fusionId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.svc.listBoneSegments(caseId, req.user.orgId, fusionId);
  }

  @Patch('fusions/:fusionId/segments/:segmentId/density')
  updateDensity(
    @Param('caseId') caseId: string,
    @Param('fusionId') fusionId: string,
    @Param('segmentId') segmentId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: { densityHu: number },
  ) {
    return this.svc.updateSegmentDensity(
      caseId, req.user.orgId, fusionId, segmentId, body.densityHu,
    );
  }
}
