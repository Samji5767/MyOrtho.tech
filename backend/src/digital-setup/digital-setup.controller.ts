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
  UnauthorizedException,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import {
  DigitalSetupService,
  type CreateSetupDto,
  type MoveToothDto,
  type MovementType,
} from './digital-setup.service';

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

@Controller('api/digital-setup')
@UseGuards(AuthGuard)
export class DigitalSetupController {
  constructor(private readonly svc: DigitalSetupService) {}

  @Post()
  create(
    @Req() req: Request,
    @Body() body: { caseId: string; treatmentGoalId?: string; name?: string },
  ) {
    const user  = getUser(req);
    const orgId = requireOrgId(user);
    if (!body.caseId) throw new BadRequestException('caseId is required');
    const dto: CreateSetupDto = {
      treatmentGoalId: body.treatmentGoalId,
      name: body.name,
    };
    return this.svc.createSetup(orgId, body.caseId, user.id, dto);
  }

  @Get()
  list(@Req() req: Request, @Query('caseId') caseId: string) {
    const user  = getUser(req);
    const orgId = requireOrgId(user);
    if (!caseId) throw new BadRequestException('caseId query param is required');
    return this.svc.listSetups(orgId, caseId);
  }

  @Get(':id')
  getOne(@Req() req: Request, @Param('id') id: string) {
    const user  = getUser(req);
    const orgId = requireOrgId(user);
    return this.svc.getSetup(orgId, id);
  }

  @Patch(':id/move')
  moveTooth(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { toothFdi: number; movementType: MovementType; deltaValue: number },
  ) {
    const user  = getUser(req);
    const orgId = requireOrgId(user);
    if (body.toothFdi === undefined) throw new BadRequestException('toothFdi is required');
    if (!body.movementType) throw new BadRequestException('movementType is required');
    if (body.deltaValue === undefined) throw new BadRequestException('deltaValue is required');
    const dto: MoveToothDto = {
      toothFdi: body.toothFdi,
      movementType: body.movementType,
      deltaValue: body.deltaValue,
    };
    return this.svc.moveTooth(orgId, id, user.id, dto);
  }

  @Patch(':id/reset-tooth/:fdi')
  resetTooth(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('fdi', ParseIntPipe) fdi: number,
  ) {
    const user  = getUser(req);
    const orgId = requireOrgId(user);
    return this.svc.resetTooth(orgId, id, user.id, fdi);
  }

  @Patch(':id/lock-tooth/:fdi')
  lockTooth(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('fdi', ParseIntPipe) fdi: number,
    @Body() body: { locked: boolean },
  ) {
    const user  = getUser(req);
    const orgId = requireOrgId(user);
    if (body.locked === undefined) throw new BadRequestException('locked boolean is required');
    return this.svc.lockTooth(orgId, id, fdi, body.locked);
  }

  @Get(':id/history')
  getHistory(@Req() req: Request, @Param('id') id: string) {
    const user  = getUser(req);
    const orgId = requireOrgId(user);
    return this.svc.getMovementHistory(orgId, id);
  }

  @Post(':id/approve')
  approve(@Req() req: Request, @Param('id') id: string) {
    const user  = getUser(req);
    const orgId = requireOrgId(user);
    return this.svc.approveSetup(orgId, id, user.id);
  }
}
