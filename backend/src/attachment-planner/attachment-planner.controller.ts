import { Controller, Get, Post, Delete, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AttachmentPlannerService, type CreateAttachmentDto } from './attachment-planner.service';
import type { AuthenticatedRequest } from '../common/auth-request.type';

@Controller('api/cases/:caseId/plans/:planId/attachments')
@UseGuards(AuthGuard)
export class AttachmentPlannerController {
  constructor(private readonly svc: AttachmentPlannerService) {}

  @Get()
  list(@Param('planId') planId: string, @Param('caseId') caseId: string, @Request() req: AuthenticatedRequest) {
    return this.svc.listAttachments(planId, caseId, req.user.orgId as string);
  }

  @Post()
  add(
    @Param('planId') planId: string,
    @Param('caseId') caseId: string,
    @Body() dto: CreateAttachmentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.svc.addAttachment(planId, caseId, req.user.orgId as string, dto, req.user.id as string);
  }

  @Delete(':attachmentId')
  remove(
    @Param('attachmentId') attachmentId: string,
    @Param('planId') planId: string,
    @Param('caseId') caseId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.svc.deleteAttachment(attachmentId, planId, caseId, req.user.orgId as string);
  }

  @Patch(':attachmentId/approve')
  approve(
    @Param('attachmentId') attachmentId: string,
    @Param('planId') planId: string,
    @Param('caseId') caseId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.svc.approveAttachment(attachmentId, planId, caseId, req.user.orgId as string, req.user.id as string);
  }

  @Post('recommend')
  recommend(@Param('planId') planId: string, @Param('caseId') caseId: string, @Request() req: AuthenticatedRequest) {
    return this.svc.autoRecommend(planId, caseId, req.user.orgId as string, req.user.id as string);
  }

  @Post('optimize')
  optimizeFromPrescriptions(@Param('planId') planId: string, @Param('caseId') caseId: string, @Request() req: AuthenticatedRequest) {
    return this.svc.optimizeFromPrescriptions(planId, caseId, req.user.orgId as string, req.user.id as string);
  }
}
