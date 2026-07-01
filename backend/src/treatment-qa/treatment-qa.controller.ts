import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { TreatmentQAService } from './treatment-qa.service';

interface AuthUser {
  id: string;
  orgId: string | null;
}

function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/treatment-qa')
@UseGuards(AuthGuard)
export class TreatmentQAController {
  constructor(private readonly svc: TreatmentQAService) {}

  @Post(':setupId')
  runQACheck(@Param('setupId') setupId: string, @Req() req: Request) {
    const { orgId } = getUser(req);
    return this.svc.runQACheck(orgId, setupId);
  }

  @Get(':setupId')
  getLatestQA(@Param('setupId') setupId: string, @Req() req: Request) {
    const { orgId } = getUser(req);
    return this.svc.getLatestQA(orgId, setupId);
  }
}
