import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { DocumentsService } from './documents.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/documents')
@UseGuards(AuthGuard)
export class DocumentsController {
  constructor(private readonly svc: DocumentsService) {}

  @Get()
  list(
    @Req() req: Request,
    @Query('caseId') caseId?: string,
    @Query('patientId') patientId?: string,
    @Query('documentType') documentType?: string,
  ) {
    return this.svc.list(getUser(req).orgId, { caseId, patientId, documentType });
  }

  @Post()
  upload(
    @Req() req: Request,
    @Body() body: { caseId?: string; patientId?: string; documentType: string; fileName: string; fileUrl: string; fileSizeBytes?: number; mimeType?: string; tags?: string[] },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.upload(orgId, id, body);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.svc.delete(id, getUser(req).orgId);
  }
}
