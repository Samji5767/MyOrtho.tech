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
import { ManufacturingService } from './manufacturing.service';
import { CreatePrintJobDto, UpdatePrintJobStatusDto } from './manufacturing.dto';

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
@UseGuards(AuthGuard)
export class ManufacturingController {
  constructor(private readonly service: ManufacturingService) {}

  @Get()
  listJobs(@Req() req: Request) {
    return this.service.listJobs(auth(req).orgId!);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
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
    return this.service.updateJobStatus(id, user.orgId!, dto.status, user.email);
  }
}

/**
 * Printer registry — read-only from database.
 * Real-time telemetry requires a vendor connector (not yet configured).
 */
@Controller('api/printers')
@UseGuards(AuthGuard)
export class PrinterRegistryController {
  constructor(private readonly service: ManufacturingService) {}

  @Get()
  listPrinters(@Req() req: Request) {
    return this.service.listPrinters(auth(req).orgId!);
  }
}
