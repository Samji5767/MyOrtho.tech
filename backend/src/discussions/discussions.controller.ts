import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { DiscussionsService, CreateDiscussionDto, ResolveDiscussionDto } from './discussions.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';

interface AuthUser { id: string; email: string; role: string; orgId: string | null }
function getUser(req: Request): AuthUser {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u) throw new UnauthorizedException();
  return u;
}

@Controller('api/cases/:caseId/discussions')
@UseGuards(AuthGuard, PermissionsGuard)
export class DiscussionsController {
  constructor(private readonly discussionsService: DiscussionsService) {}

  @Get()
  @RequirePermission('cases:read')
  async list(@Req() req: Request, @Param('caseId') caseId: string) {
    const user = getUser(req);
    if (!user.orgId) throw new UnauthorizedException('No organization assigned');
    return this.discussionsService.listByCaseId(caseId, user.orgId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('cases:write')
  async create(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() dto: CreateDiscussionDto,
  ) {
    const user = getUser(req);
    if (!user.orgId) throw new UnauthorizedException('No organization assigned');
    return this.discussionsService.create(caseId, user.orgId, user.id, dto);
  }

  @Patch(':id/resolve')
  @RequirePermission('cases:write')
  async resolve(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ResolveDiscussionDto,
  ) {
    const user = getUser(req);
    if (!user.orgId) throw new UnauthorizedException('No organization assigned');
    return this.discussionsService.resolve(id, user.orgId, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('cases:write')
  async delete(@Req() req: Request, @Param('id') id: string) {
    const user = getUser(req);
    if (!user.orgId) throw new UnauthorizedException('No organization assigned');
    await this.discussionsService.delete(id, user.orgId, user.id);
  }
}
