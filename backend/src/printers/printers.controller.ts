import { Controller, Get, Post, Body, Param, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { PrintersService } from './printers.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('api/printers/connectors')
@UseGuards(AuthGuard)
export class PrintersController {
  constructor(private readonly printersService: PrintersService) {}

  /**
   * Live telemetry — requires vendor connector to be configured.
   * Returns connector_required until Formlabs/SprintRay credentials are set.
   */
  @Get(':id/telemetry')
  async getTelemetry(@Req() req, @Param('id') id: string) {
    const orgId = (req.user as { orgId?: string })?.orgId;
    if (!orgId) throw new BadRequestException('User organization context not found');
    return this.printersService.getTelemetry(id, orgId);
  }

  /** Dispatch a print job via vendor connector — connector_required. */
  @Post(':id/job')
  async dispatchJob(
    @Req() req,
    @Param('id') id: string,
    @Body() jobDetails: any
  ) {
    const orgId = (req.user as { orgId?: string })?.orgId;
    if (!orgId) throw new BadRequestException('User organization context not found');
    return this.printersService.submitJob(id, orgId, jobDetails);
  }

  /** Reroute a failed job to another printer — connector_required. */
  @Post('job/:jobId/reroute')
  async rerouteJob(@Req() req, @Param('jobId') jobId: string) {
    const orgId = (req.user as { orgId?: string })?.orgId;
    if (!orgId) {
      throw new BadRequestException('User organization context not found');
    }
    return this.printersService.rerouteFailedJob(jobId, orgId);
  }
}
