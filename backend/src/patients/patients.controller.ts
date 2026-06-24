import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PatientsService, type CreatePatientDto, type UpdatePatientDto } from './patients.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';

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
  async getPatients(@Req() req: Request) {
    const user = getUser(req);
    if (!user.orgId) return [];
    return this.patientsService.findAllByOrg(user.orgId);
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
}
