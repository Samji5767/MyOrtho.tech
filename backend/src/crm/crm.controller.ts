import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CrmService } from './crm.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api')
@UseGuards(AuthGuard)
export class CrmController {
  constructor(private readonly svc: CrmService) {}

  @Get('patients/:patientId/notes')
  listNotes(@Req() req: Request, @Param('patientId') patientId: string) {
    return this.svc.listNotes(patientId, getUser(req).orgId);
  }

  @Post('patients/:patientId/notes')
  addNote(
    @Req() req: Request,
    @Param('patientId') patientId: string,
    @Body() body: { noteType?: string; content: string; isPinned?: boolean },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.addNote(orgId, patientId, id, body);
  }

  @Patch('patient-notes/:noteId/pin')
  pinNote(@Req() req: Request, @Param('noteId') noteId: string, @Body() body: { pinned: boolean }) {
    return this.svc.pinNote(noteId, getUser(req).orgId, body.pinned);
  }

  @Get('patients/:patientId/tags')
  getTags(@Req() req: Request, @Param('patientId') patientId: string) {
    return this.svc.getTags(patientId, getUser(req).orgId);
  }

  @Post('patients/:patientId/tags')
  addTag(@Req() req: Request, @Param('patientId') patientId: string, @Body() body: { tag: string }) {
    const { id, orgId } = getUser(req);
    return this.svc.addTag(orgId, patientId, id, body.tag);
  }

  @Delete('patients/:patientId/tags/:tag')
  removeTag(@Req() req: Request, @Param('patientId') patientId: string, @Param('tag') tag: string) {
    return this.svc.removeTag(getUser(req).orgId, patientId, tag);
  }

  @Get('patients/search-by-tag')
  searchByTag(@Req() req: Request, @Query('tag') tag: string) {
    return this.svc.searchPatientsByTag(getUser(req).orgId, tag);
  }
}
