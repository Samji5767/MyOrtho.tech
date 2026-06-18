import { Controller, Get, Post, Body, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { CasesService } from './cases.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('cases')
@UseGuards(AuthGuard)
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Get()
  async getCases(@Req() req) {
    const orgId = req.user.organizationId;
    if (!orgId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    return this.casesService.findAllByOrg(orgId);
  }

  @Post()
  async createCase(@Req() req, @Body() createDto: any) {
    const orgId = req.user.organizationId;
    if (!orgId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    return this.casesService.create(orgId, createDto);
  }

  @Get(':id')
  async getCaseById(@Req() req, @Param('id') id: string) {
    const orgId = req.user.organizationId;
    return this.casesService.findOne(id, orgId);
  }

  @Post(':id/approve')
  async approveCase(
    @Req() req,
    @Param('id') id: string,
    @Body('signature') signature: string
  ) {
    const orgId = req.user.organizationId;
    const userId = req.user.id;
    return this.casesService.approveStaging(id, orgId, userId, signature);
  }
}
