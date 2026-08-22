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
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ToothMovementsService } from './tooth-movements.service';

// Bounds are data-integrity limits (mirrored by DB CHECK constraints in
// migration 075), not clinical validation. Clinical review remains with the
// approving doctor.
class UpsertToothMovementBody {
  @IsInt() @Min(11) @Max(48)
  fdiNumber: number;

  @IsOptional() @IsNumber() @Min(-20) @Max(20)
  mesiodistalMm?: number;

  @IsOptional() @IsNumber() @Min(-20) @Max(20)
  buccolingualMm?: number;

  @IsOptional() @IsNumber() @Min(-20) @Max(20)
  occlusogingivalMm?: number;

  @IsOptional() @IsNumber() @Min(-90) @Max(90)
  rotationDeg?: number;

  @IsOptional() @IsNumber() @Min(-90) @Max(90)
  tipDeg?: number;

  @IsOptional() @IsNumber() @Min(-90) @Max(90)
  torqueDeg?: number;

  @IsOptional() @IsBoolean()
  isLocked?: boolean;

  @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;
}

class CreateMeasurementBody {
  @IsOptional() @IsString() @MaxLength(200)
  measurementLabel?: string;

  @IsOptional() @IsNumber() @Min(-30) @Max(30)
  overjetMm?: number;

  @IsOptional() @IsNumber() @Min(-30) @Max(30)
  overbiteMm?: number;

  @IsOptional() @IsString() @MaxLength(50)
  angleClass?: string;

  @IsOptional() @IsNumber() @Min(0) @Max(200)
  distanceMm?: number;

  @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;
}

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
 * Per-tooth movement editor. Stores the canonical signed anatomical movement
 * components per (stage, FDI tooth) and mirrors them into the stage's
 * movement_data JSON for the 3D viewer.
 */
@Controller('api/cases/:caseId/plans/:planId/stages/:stageId/tooth-movements')
@UseGuards(AuthGuard, PermissionsGuard)
export class ToothMovementsController {
  constructor(private readonly service: ToothMovementsService) {}

  @Get()
  @RequirePermission('cases:read')
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
  @RequirePermission('cases:write')
  upsert(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Param('stageId') stageId: string,
    @Body() dto: UpsertToothMovementBody,
  ) {
    const user = auth(req);
    return this.service.upsert(caseId, planId, stageId, user.orgId!, dto, user.email);
  }

  /** Remove movement record for a tooth (resets to zero). */
  @Delete(':fdiNumber')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('cases:write')
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
@UseGuards(AuthGuard, PermissionsGuard)
export class ClinicalMeasurementsController {
  constructor(private readonly service: ToothMovementsService) {}

  @Get()
  @RequirePermission('cases:read')
  list(@Req() req: Request, @Param('caseId') caseId: string) {
    const user = auth(req);
    return this.service.listMeasurements(caseId, user.orgId!);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('cases:write')
  create(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() dto: CreateMeasurementBody,
  ) {
    const user = auth(req);
    return this.service.createMeasurement(caseId, user.orgId!, user.id, dto, user.email);
  }
}
