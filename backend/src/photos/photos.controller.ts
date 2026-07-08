import {
  Controller, Get, Post, Delete, Param, Body, UseGuards, Request,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { AuditService } from '../audit/audit.service';
import { PhotosService, UploadPhotoDto } from './photos.service';
import type { AuthenticatedRequest } from '../common/auth-request.type';

@Controller('api/cases/:caseId/photos')
@UseGuards(AuthGuard, PermissionsGuard)
export class PhotosController {
  constructor(
    private readonly photos: PhotosService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @RequirePermission('cases:read')
  list(@Param('caseId') caseId: string, @Request() req: AuthenticatedRequest) {
    return this.photos.list(caseId, req.user.orgId);
  }

  @Post()
  @RequirePermission('cases:write')
  async create(
    @Param('caseId') caseId: string,
    @Body() dto: UploadPhotoDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const result = await this.photos.create(caseId, req.user.orgId, {
      ...dto,
      uploadedBy: dto.uploadedBy ?? req.user.id,
    });
    await this.auditService.log({
      organizationId: req.user.orgId,
      actorId: req.user.id,
      actorEmail: req.user.email,
      resourceType: 'photo',
      resourceId: result.id,
      action: 'photo.created',
      details: { caseId },
    });
    return result;
  }

  @Delete(':photoId')
  @RequirePermission('cases:write')
  async delete(
    @Param('caseId') caseId: string,
    @Param('photoId') photoId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.photos.delete(caseId, req.user.orgId, photoId);
    await this.auditService.log({
      organizationId: req.user.orgId,
      actorId: req.user.id,
      actorEmail: req.user.email,
      resourceType: 'photo',
      resourceId: photoId,
      action: 'photo.deleted',
      details: { caseId },
    });
  }
}
