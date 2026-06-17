import { Controller, Get, Post, Body, Param, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { PrintersService } from './printers.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('printers')
@UseGuards(AuthGuard)
export class PrintersController {
  constructor(private readonly printersService: PrintersService) {}

  @Get(':id/telemetry')
  async getTelemetry(@Req() req, @Param('id') id: string) {
    const orgId = req.user.organizationId;
    return this.printersService.getTelemetry(id, orgId);
  }

  @Post(':id/job')
  async dispatchJob(
    @Req() req,
    @Param('id') id: string,
    @Body() jobDetails: any
  ) {
    const orgId = req.user.organizationId;
    return this.printersService.submitJob(id, orgId, jobDetails);
  }

  @Post('job/:jobId/reroute')
  async rerouteJob(@Req() req, @Param('jobId') jobId: string) {
    const orgId = req.user.organizationId;
    if (!orgId) {
      throw new BadRequestException('User organization context not found');
    }
    return this.printersService.rerouteFailedJob(jobId, orgId);
  }
}
