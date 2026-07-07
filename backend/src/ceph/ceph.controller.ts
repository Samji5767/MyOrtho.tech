import {
  Controller, Get, Post, Delete, Param, Body, UseGuards, Request,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CephService, CreateCephDto } from './ceph.service';
import type { AuthenticatedRequest } from '../common/auth-request.type';

@Controller('api/cases/:caseId/ceph')
@UseGuards(AuthGuard)
export class CephController {
  constructor(private readonly ceph: CephService) {}

  @Get()
  list(@Param('caseId') caseId: string, @Request() req: AuthenticatedRequest) {
    return this.ceph.list(caseId, req.user.orgId);
  }

  @Post()
  create(
    @Param('caseId') caseId: string,
    @Body() dto: CreateCephDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.ceph.create(caseId, req.user.orgId, {
      ...dto,
      createdBy: dto.createdBy ?? req.user.id,
    });
  }

  @Get(':id')
  findOne(
    @Param('caseId') caseId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.ceph.findOne(caseId, req.user.orgId, id);
  }

  @Delete(':id')
  delete(
    @Param('caseId') caseId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.ceph.delete(caseId, req.user.orgId, id);
  }
}
