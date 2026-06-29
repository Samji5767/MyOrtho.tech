import { Controller, Get, Post, Body, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CommandPaletteService } from './command-palette.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/commands')
@UseGuards(AuthGuard)
export class CommandPaletteController {
  constructor(private readonly svc: CommandPaletteService) {}

  @Get()
  listCommands(@Query('q') q?: string) { return this.svc.listCommands(q); }

  @Get('frequent')
  frequent(@Req() req: Request) {
    const { id, orgId } = getUser(req);
    return this.svc.getFrequentCommands(orgId, id);
  }

  @Get('recent')
  recent(@Req() req: Request) {
    const { id, orgId } = getUser(req);
    return this.svc.getRecentCommands(orgId, id);
  }

  @Post('execute')
  execute(@Req() req: Request, @Body() body: { commandId: string }) {
    const { id, orgId } = getUser(req);
    return this.svc.recordExecution(orgId, id, body.commandId);
  }
}
