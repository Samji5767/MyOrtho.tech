import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SearchService } from './search.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';

interface AuthUser { id: string; email: string; role: string; orgId: string | null }
function getUser(req: Request): AuthUser {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u) throw new UnauthorizedException();
  return u;
}

@Controller('api/search')
@UseGuards(AuthGuard, PermissionsGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @RequirePermission('patients:read')
  async search(
    @Req() req: Request,
    @Query('q') q: string = '',
    @Query('scope') scope: string = 'all',
    @Query('limit') limit?: string,
  ) {
    const user = getUser(req);
    if (!user.orgId) return { results: [], total: 0 };
    const l = limit ? Math.min(50, Math.max(1, parseInt(limit, 10))) : 20;
    return this.searchService.search(q, user.orgId, scope, l);
  }

  @Get('saved')
  @RequirePermission('patients:read')
  async getSavedSearches(@Req() req: Request) {
    const user = getUser(req);
    if (!user.orgId) return [];
    return this.searchService.getSavedSearches(user.id, user.orgId);
  }

  @Post('saved')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('patients:read')
  async saveSearch(
    @Req() req: Request,
    @Body() dto: { name: string; query: string; filters?: Record<string, unknown>; scope?: string },
  ) {
    const user = getUser(req);
    if (!user.orgId) throw new UnauthorizedException('No organization assigned');
    return this.searchService.saveSearch(user.id, user.orgId, dto);
  }

  @Delete('saved/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('patients:read')
  async deleteSavedSearch(@Req() req: Request, @Param('id') id: string) {
    const user = getUser(req);
    if (!user.orgId) throw new UnauthorizedException('No organization assigned');
    await this.searchService.deleteSavedSearch(id, user.id, user.orgId);
  }
}
