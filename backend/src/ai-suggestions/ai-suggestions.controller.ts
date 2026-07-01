import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AiSuggestionsService } from './ai-suggestions.service';

interface AuthUser {
  id: string;
  orgId: string | null;
}

function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/ai-suggestions')
@UseGuards(AuthGuard)
export class AiSuggestionsController {
  constructor(private readonly svc: AiSuggestionsService) {}

  @Post('generate/:setupId')
  generateSuggestions(
    @Param('setupId') setupId: string,
    @Req() req: Request,
  ) {
    const { orgId } = getUser(req);
    return this.svc.generateSuggestions(orgId, setupId);
  }

  @Get()
  listSuggestions(
    @Query('setupId') setupId: string,
    @Query('onlyActive') onlyActive: string,
    @Req() req: Request,
  ) {
    const { orgId } = getUser(req);
    const active = onlyActive === 'true' || onlyActive === '1';
    return this.svc.listSuggestions(orgId, setupId, active || undefined);
  }

  @Patch(':id/acknowledge')
  acknowledgeSuggestion(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const { id: userId, orgId } = getUser(req);
    return this.svc.acknowledgeSuggestion(orgId, id, userId);
  }

  @Patch(':id/apply')
  applySuggestion(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const { id: userId, orgId } = getUser(req);
    return this.svc.applySuggestion(orgId, id, userId);
  }
}
