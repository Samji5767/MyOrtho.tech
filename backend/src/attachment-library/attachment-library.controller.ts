import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AttachmentLibraryService } from './attachment-library.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/attachment-library')
@UseGuards(AuthGuard)
export class AttachmentLibraryController {
  constructor(private readonly svc: AttachmentLibraryService) {}

  @Get()
  list(@Req() req: Request, @Query('type') type?: string) {
    return this.svc.list(getUser(req).orgId, type);
  }

  @Post()
  create(@Req() req: Request, @Body() body: { name: string; attachmentType?: string; toothTypes?: string[]; geometry?: Record<string, unknown>; notes?: string }) {
    return this.svc.create(getUser(req).orgId, body);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() body: { name?: string; attachmentType?: string; toothTypes?: string[]; geometry?: Record<string, unknown>; notes?: string }) {
    return this.svc.update(id, getUser(req).orgId, body);
  }
}
