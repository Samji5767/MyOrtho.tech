import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UnauthorizedException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { TreatmentStagesService } from './treatment-stages.service';

interface AuthUser {
  id: string;
  email: string;
  role: string;
  name: string;
  orgId: string | null;
}

function getUser(req: Request): AuthUser {
  const user = (req as Request & { user?: AuthUser }).user;
  if (!user) throw new UnauthorizedException('No session');
  return user;
}

function requireOrgId(user: AuthUser): string {
  if (!user.orgId) throw new UnauthorizedException('Organization context required');
  return user.orgId;
}

@Controller('api/treatment-stages')
@UseGuards(AuthGuard)
export class TreatmentStagesController {
  constructor(private readonly svc: TreatmentStagesService) {}

  @Post('generate/:setupId')
  generateStages(@Req() req: Request, @Param('setupId') setupId: string) {
    const user  = getUser(req);
    const orgId = requireOrgId(user);
    return this.svc.generateStages(orgId, setupId);
  }

  @Get()
  listStages(@Req() req: Request, @Query('setupId') setupId: string) {
    const user  = getUser(req);
    const orgId = requireOrgId(user);
    if (!setupId) throw new BadRequestException('setupId query param is required');
    return this.svc.listStages(orgId, setupId);
  }

  @Get(':id')
  getStage(@Req() req: Request, @Param('id') id: string) {
    const user  = getUser(req);
    const orgId = requireOrgId(user);
    return this.svc.getStage(orgId, id);
  }

  @Patch(':id/notes')
  updateNotes(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { notes: string },
  ) {
    const user  = getUser(req);
    const orgId = requireOrgId(user);
    if (body.notes === undefined) throw new BadRequestException('notes is required');
    return this.svc.updateStageNotes(orgId, id, body.notes);
  }

  @Delete(':setupId/all')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAll(@Req() req: Request, @Param('setupId') setupId: string) {
    const user  = getUser(req);
    const orgId = requireOrgId(user);
    return this.svc.deleteStages(orgId, setupId);
  }
}
