import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { ToothSegmentationService, ReviewSegmentationDto } from './tooth-segmentation.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/segmentation')
@UseGuards(AuthGuard)
export class ToothSegmentationController {
  constructor(private readonly svc: ToothSegmentationService) {}

  @Post(':uploadId')
  segmentTeeth(
    @Req() req: Request,
    @Param('uploadId') uploadId: string,
    @Body() body: { archType: string },
  ) {
    const { orgId } = getUser(req);
    return this.svc.segmentTeeth(orgId, uploadId, body.archType);
  }

  @Get(':uploadId')
  getSegmentation(
    @Req() req: Request,
    @Param('uploadId') uploadId: string,
  ) {
    const { orgId } = getUser(req);
    return this.svc.getSegmentation(orgId, uploadId);
  }

  @Patch(':segId/review')
  reviewSegmentation(
    @Req() req: Request,
    @Param('segId') segId: string,
    @Body() body: ReviewSegmentationDto,
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.reviewSegmentation(orgId, segId, id, body);
  }
}
