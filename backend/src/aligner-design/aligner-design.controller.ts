import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AlignerDesignService, UpdateAlignerDto } from './aligner-design.service';

interface AuthUser {
  id: string;
  orgId: string | null;
}

function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/aligner-design')
@UseGuards(AuthGuard)
export class AlignerDesignController {
  constructor(private readonly svc: AlignerDesignService) {}

  @Post('generate/:setupId')
  generateAligners(@Param('setupId') setupId: string, @Req() req: Request) {
    const { orgId } = getUser(req);
    return this.svc.generateAligners(orgId, setupId);
  }

  @Get()
  listAligners(@Query('setupId') setupId: string, @Req() req: Request) {
    const { orgId } = getUser(req);
    return this.svc.listAligners(orgId, setupId);
  }

  @Get('manufacturing-package/:setupId')
  generateManufacturingPackage(
    @Param('setupId') setupId: string,
    @Req() req: Request,
  ) {
    const { orgId } = getUser(req);
    return this.svc.generateManufacturingPackage(orgId, setupId);
  }

  @Get(':id')
  getAligner(@Param('id') id: string, @Req() req: Request) {
    const { orgId } = getUser(req);
    return this.svc.getAligner(orgId, id);
  }

  @Patch(':id')
  updateAligner(
    @Param('id') id: string,
    @Body() body: UpdateAlignerDto,
    @Req() req: Request,
  ) {
    const { orgId } = getUser(req);
    return this.svc.updateAligner(orgId, id, body);
  }
}
