import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { ToothMovementsService, UpsertToothMovementDto, CreateMeasurementDto } from './tooth-movements.service';

interface AuthUser {
  id: string;
  email: string;
  orgId: string | null;
}

function auth(req: Request): AuthUser {
  const user = (req as Request & { user?: AuthUser }).user;
  if (!user?.orgId) throw new UnauthorizedException('No organization context');
  return user;
}

/**
 * Tooth movement editor (Phase 15D)
 * Status: Implemented — per-tooth FDI movement storage in tooth_movements table.
 * Automated alignment: Planned. AI movement proposals: Simulated (not available).
 */
@Controller('api/cases/:caseId/plans/:planId/stages/:stageId/tooth-movements')
@UseGuards(AuthGuard)
export class ToothMovementsController {
  constructor(private readonly service: ToothMovementsService) {}

  @Get()
  list(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Param('stageId') stageId: string,
  ) {
    const user = auth(req);
    return this.service.listForStage(caseId, planId, stageId, user.orgId!);
  }

  /** Create or update movement for a tooth (upsert by FDI number). */
  @Put()
  @HttpCode(HttpStatus.OK)
  upsert(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Param('stageId') stageId: string,
    @Body() dto: UpsertToothMovementDto,
  ) {
    const user = auth(req);
    return this.service.upsert(caseId, planId, stageId, user.orgId!, dto, user.email);
  }

  /** Remove movement record for a tooth (resets to zero). */
  @Delete(':fdiNumber')
  @HttpCode(HttpStatus.OK)
  delete(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Param('stageId') stageId: string,
    @Param('fdiNumber', ParseIntPipe) fdiNumber: number,
  ) {
    const user = auth(req);
    return this.service.delete(caseId, planId, stageId, fdiNumber, user.orgId!, user.email);
  }
}

/** Clinical measurements (overjet, overbite, angle class, distances). */
@Controller('api/cases/:caseId/measurements')
@UseGuards(AuthGuard)
export class ClinicalMeasurementsController {
  constructor(private readonly service: ToothMovementsService) {}

  @Get()
  list(@Req() req: Request, @Param('caseId') caseId: string) {
    const user = auth(req);
    return this.service.listMeasurements(caseId, user.orgId!);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() dto: CreateMeasurementDto,
  ) {
    const user = auth(req);
    return this.service.createMeasurement(caseId, user.orgId!, user.id, dto, user.email);
  }
}
