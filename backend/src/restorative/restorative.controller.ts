import { Controller, Get, Post, Body, Param, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { RestorativeService } from './restorative.service';
import { AuthGuard } from '../auth/auth.guard';

interface AuthUser { id: string; orgId: string | null }

function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('restorative')
@UseGuards(AuthGuard)
export class RestorativeController {
  constructor(private readonly restorativeService: RestorativeService) {}

  @Post('design')
  async createRestorativeDesign(@Req() req: Request, @Body() designDto: any) {
    const { orgId } = getUser(req);
    return this.restorativeService.createDesign(orgId, designDto);
  }

  @Get(':id')
  async getDesignById(@Req() req: Request, @Param('id') id: string) {
    const { orgId } = getUser(req);
    return this.restorativeService.findOne(id, orgId);
  }
}
