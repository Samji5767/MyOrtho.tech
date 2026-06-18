import { Controller, Get, Post, Body, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { RestorativeService } from './restorative.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('restorative')
@UseGuards(AuthGuard)
export class RestorativeController {
  constructor(private readonly restorativeService: RestorativeService) {}

  @Post('design')
  async createRestorativeDesign(@Req() req, @Body() designDto: any) {
    const orgId = req.user.organizationId;
    if (!orgId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    return this.restorativeService.createDesign(orgId, designDto);
  }

  @Get(':id')
  async getDesignById(@Req() req, @Param('id') id: string) {
    const orgId = req.user.organizationId;
    return this.restorativeService.findOne(id, orgId);
  }
}
