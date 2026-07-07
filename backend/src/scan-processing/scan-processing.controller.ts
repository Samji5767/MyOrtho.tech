import {
  Controller, Post, Get, Patch, Param, Body, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ScanProcessingService } from './scan-processing.service';
import type { AuthenticatedRequest } from '../common/auth-request.type';

@Controller('api/cases/:caseId/scans/:scanId/processing')
@UseGuards(AuthGuard)
export class ScanProcessingController {
  constructor(private readonly svc: ScanProcessingService) {}

  @Post('orient')
  orient(
    @Param('caseId') caseId: string,
    @Param('scanId') scanId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.svc.runAutoOrient(caseId, req.user.orgId, req.user.id, scanId);
  }

  @Post('cleanup')
  cleanup(
    @Param('caseId') caseId: string,
    @Param('scanId') scanId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.svc.runAutoCleanup(caseId, req.user.orgId, req.user.id, scanId);
  }

  @Post('tooth-id')
  assignToothIds(
    @Param('caseId') caseId: string,
    @Param('scanId') scanId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: { segmentationJobId?: string },
  ) {
    return this.svc.assignToothIds(
      caseId, req.user.orgId, req.user.id, scanId, body.segmentationJobId,
    );
  }

  @Get('tooth-id')
  getToothIds(
    @Param('caseId') caseId: string,
    @Param('scanId') scanId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.svc.getToothIds(caseId, req.user.orgId, scanId);
  }

  @Patch('tooth-id/:fdiNumber/confirm')
  confirmToothId(
    @Param('caseId') caseId: string,
    @Param('scanId') scanId: string,
    @Param('fdiNumber') fdiNumber: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: { newFdi?: number },
  ) {
    return this.svc.confirmToothId(
      caseId, req.user.orgId, req.user.id, scanId,
      parseInt(fdiNumber, 10), body.newFdi,
    );
  }

  @Get('jobs')
  listJobs(
    @Param('caseId') caseId: string,
    @Param('scanId') scanId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.svc.listJobs(caseId, req.user.orgId, scanId);
  }
}
