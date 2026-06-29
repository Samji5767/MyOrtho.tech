import { Body, Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AttachmentIntelligenceService, type AttachmentLibraryEntry } from './attachment-intelligence.service';

@Controller()
@UseGuards(AuthGuard)
export class AttachmentIntelligenceController {
  constructor(private readonly svc: AttachmentIntelligenceService) {}

  @Get('api/attachments/library')
  getLibrary(@Req() req: any) {
    return this.svc.getLibrary(req.user.orgId);
  }

  @Post('api/attachments/library/custom')
  createCustom(@Req() req: any, @Body() dto: Omit<AttachmentLibraryEntry, 'id' | 'isSystem'>) {
    return this.svc.createCustomAttachment(req.user.orgId, dto);
  }

  @Post('api/cases/:caseId/plans/:planId/attachments/optimize')
  optimize(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.optimizeAttachments(caseId, req.user.orgId, req.user.id, planId);
  }

  @Get('api/cases/:caseId/plans/:planId/attachments/force-analysis')
  forceAnalysis(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.getForceAnalysis(caseId, req.user.orgId, planId);
  }

  @Get('api/cases/:caseId/plans/:planId/attachments/collisions')
  collisions(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.getCollisions(caseId, req.user.orgId, planId);
  }

  @Post('api/cases/:caseId/plans/:planId/attachments/validate-manufacturing')
  validateManufacturing(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
  ) {
    return this.svc.validateManufacturing(caseId, req.user.orgId, planId);
  }
}
