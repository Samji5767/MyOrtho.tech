import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ManufacturingService } from './manufacturing.service';
import { CreatePrintJobDto, UpdatePrintJobStatusDto, CancelJobDto } from './manufacturing.dto';

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

/** Print job management — requires auth. */
@Controller('api/manufacturing/jobs')
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermission('manufacturing:read')
export class ManufacturingController {
  constructor(private readonly service: ManufacturingService) {}

  @Get()
  listJobs(@Req() req: Request) {
    return this.service.listJobs(auth(req).orgId!);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('manufacturing:write')
  createJob(@Req() req: Request, @Body() dto: CreatePrintJobDto) {
    const user = auth(req);
    return this.service.createJob(user.orgId!, user.id, dto, user.email);
  }

  @Get(':id')
  getJob(@Req() req: Request, @Param('id') id: string) {
    return this.service.getJob(id, auth(req).orgId!);
  }

  @Patch(':id/status')
  updateStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdatePrintJobStatusDto,
  ) {
    const user = auth(req);
    return this.service.updateJobStatus(id, user.orgId!, dto.status, user.email, dto.failureReason);
  }

  /** Re-queue a failed job. Connector state must be resolved first. */
  @Post(':id/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  retryJob(@Req() req: Request, @Param('id') id: string) {
    const user = auth(req);
    return this.service.retryJob(id, user.orgId!, user.email);
  }

  /** Cancel an in-progress or queued job. */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelJob(@Req() req: Request, @Param('id') id: string, @Body() dto: CancelJobDto) {
    const user = auth(req);
    return this.service.cancelJob(id, user.orgId!, dto, user.email);
  }
}

/**
 * Printer registry — reads connector_status from DB.
 * Real-time telemetry requires a configured vendor connector.
 */
@Controller('api/printers')
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermission('manufacturing:read')
export class PrinterRegistryController {
  constructor(private readonly service: ManufacturingService) {}

  @Get()
  listPrinters(@Req() req: Request) {
    return this.service.listPrinters(auth(req).orgId!);
  }
}
