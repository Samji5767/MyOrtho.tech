import {
  Controller, Get, Post, Delete, Param, Body, UseGuards, Request,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PhotosService, UploadPhotoDto } from './photos.service';

@Controller('api/cases/:caseId/photos')
@UseGuards(AuthGuard)
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @Get()
  list(@Param('caseId') caseId: string, @Request() req: any) {
    return this.photos.list(caseId, req.user.orgId);
  }

  @Post()
  create(
    @Param('caseId') caseId: string,
    @Body() dto: UploadPhotoDto,
    @Request() req: any,
  ) {
    return this.photos.create(caseId, req.user.orgId, {
      ...dto,
      uploadedBy: dto.uploadedBy ?? req.user.id,
    });
  }

  @Delete(':photoId')
  delete(
    @Param('caseId') caseId: string,
    @Param('photoId') photoId: string,
    @Request() req: any,
  ) {
    return this.photos.delete(caseId, req.user.orgId, photoId);
  }
}
