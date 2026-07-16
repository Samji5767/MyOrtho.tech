import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import type { Request } from 'express';
import { PatientsService, CreatePatientDto, type UpdatePatientDto } from './patients.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';

class AddTimelineNoteDto {
  @IsString()
  note: string;

  @IsString()
  @IsOptional()
  caseId?: string;

  @IsString()
  @IsOptional()
  eventType?: string;

  @IsString()
  @IsOptional()
  eventAt?: string;
}

interface AuthUser { id: string; email: string; role: string; name: string; orgId: string | null }

function getUser(req: Request): AuthUser {
  const user = (req as Request & { user?: AuthUser }).user;
  if (!user) throw new UnauthorizedException('No session');
  return user;
}

function getIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
}

@Controller('api/patients')
@UseGuards(AuthGuard, PermissionsGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @RequirePermission('patients:read')
  async getPatients(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const user = getUser(req);
    if (!user.orgId) return [];
    const l = limit ? Math.min(500, Math.max(1, parseInt(limit, 10))) : 100;
    const o = offset ? Math.max(0, parseInt(offset, 10)) : 0;
    return this.patientsService.findAllByOrg(user.orgId, l, o);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('patients:write')
  async createPatient(@Req() req: Request, @Body() dto: CreatePatientDto) {
    const user = getUser(req);
    if (!user.orgId) throw new UnauthorizedException('No organization assigned');
    return this.patientsService.create(user.orgId, user.id, dto, {
      actorEmail: user.email,
      ipAddress: getIp(req),
    });
  }

  @Get(':id')
  @RequirePermission('patients:read')
  async getPatientById(@Req() req: Request, @Param('id') id: string) {
    const user = getUser(req);
    if (!user.orgId) throw new UnauthorizedException('No organization assigned');
    return this.patientsService.findOne(id, user.orgId);
  }

  @Patch(':id')
  @RequirePermission('patients:write')
  async updatePatient(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdatePatientDto,
  ) {
    const user = getUser(req);
    if (!user.orgId) throw new UnauthorizedException('No organization assigned');
    return this.patientsService.update(id, user.orgId, user.id, dto, {
      actorEmail: user.email,
      ipAddress: getIp(req),
    });
  }

  @Get(':id/timeline')
  @RequirePermission('patients:read')
  async getTimeline(@Req() req: Request, @Param('id') id: string) {
    const user = getUser(req);
    if (!user.orgId) throw new UnauthorizedException('No organization assigned');
    return this.patientsService.getTimeline(id, user.orgId);
  }

  @Post(':id/timeline/notes')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('patients:write')
  async addTimelineNote(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: AddTimelineNoteDto,
  ) {
    const user = getUser(req);
    if (!user.orgId) throw new UnauthorizedException('No organization assigned');
    return this.patientsService.addTimelineNote(id, user.orgId, user.id, dto);
  }
}
