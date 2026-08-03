import {
  Controller,
  Get,
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
  IsIn,
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
import { PlanFeaturesService } from './plan-features.service';

class UpsertIprBody {
  @IsInt() @Min(11) @Max(48)
  toothAFdi: number;

  @IsInt() @Min(11) @Max(48)
  toothBFdi: number;

  // DB CHECK allows up to 2.0 mm; anything above 0.5 mm is flagged unsafe.
  @IsNumber() @Min(0.05) @Max(2.0)
  amountMm: number;

  @IsOptional() @IsInt() @Min(1) @Max(120)
  beforeStage?: number;

  @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;
}

class UpsertAttachmentBody {
  @IsInt() @Min(11) @Max(48)
  fdiNumber: number;

  @IsString()
  attachmentType: string;

  @IsOptional() @IsNumber() @Min(0.5) @Max(10)
  widthMm?: number;

  @IsOptional() @IsNumber() @Min(0.5) @Max(10)
  heightMm?: number;

  @IsOptional() @IsNumber() @Min(0.1) @Max(5)
  depthMm?: number;

  @IsOptional() @IsIn(['buccal', 'lingual', 'occlusal'])
  surface?: 'buccal' | 'lingual' | 'occlusal';

  @IsOptional() @IsInt() @Min(1) @Max(120)
  activationStage?: number;

  @IsOptional() @IsInt() @Min(1) @Max(120)
  deactivationStage?: number;

  @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;
}

interface AuthUser { id: string; email: string; orgId: string | null }

function auth(req: Request): AuthUser {
  const user = (req as Request & { user?: AuthUser }).user;
  if (!user?.orgId) throw new UnauthorizedException('No organization context');
  return user;
}

/** Interproximal reduction planning — persisted per treatment plan. */
@Controller('api/cases/:caseId/plans/:planId/ipr')
@UseGuards(AuthGuard, PermissionsGuard)
export class IprController {
  constructor(private readonly service: PlanFeaturesService) {}

  @Get()
  @RequirePermission('cases:read')
  list(@Req() req: Request, @Param('caseId') caseId: string, @Param('planId') planId: string) {
    return this.service.listIpr(caseId, planId, auth(req).orgId!);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('cases:write')
  upsert(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Body() dto: UpsertIprBody,
  ) {
    const user = auth(req);
    return this.service.upsertIpr(caseId, planId, user.orgId!, user.id, dto);
  }

  @Delete(':toothAFdi/:toothBFdi')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('cases:write')
  delete(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Param('toothAFdi', ParseIntPipe) a: number,
    @Param('toothBFdi', ParseIntPipe) b: number,
  ) {
    return this.service.deleteIpr(caseId, planId, auth(req).orgId!, a, b);
  }
}

/** Attachment planning — persisted per treatment plan. */
@Controller('api/cases/:caseId/plans/:planId/attachments')
@UseGuards(AuthGuard, PermissionsGuard)
export class AttachmentsController {
  constructor(private readonly service: PlanFeaturesService) {}

  @Get()
  @RequirePermission('cases:read')
  list(@Req() req: Request, @Param('caseId') caseId: string, @Param('planId') planId: string) {
    return this.service.listAttachments(caseId, planId, auth(req).orgId!);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('cases:write')
  upsert(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Body() dto: UpsertAttachmentBody,
  ) {
    const user = auth(req);
    return this.service.upsertAttachment(caseId, planId, user.orgId!, user.id, dto);
  }

  @Delete(':fdiNumber/:attachmentType')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('cases:write')
  delete(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('planId') planId: string,
    @Param('fdiNumber', ParseIntPipe) fdiNumber: number,
    @Param('attachmentType') attachmentType: string,
  ) {
    return this.service.deleteAttachment(
      caseId, planId, auth(req).orgId!, fdiNumber, attachmentType,
    );
  }
}
