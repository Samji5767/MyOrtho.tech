import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ManufacturingReadinessGateService } from './manufacturing-readiness-gate.service';

@Controller('api/manufacturing-readiness-gate')
@UseGuards(AuthGuard, PermissionsGuard)
export class ManufacturingReadinessGateController {
  constructor(private readonly gate: ManufacturingReadinessGateService) {}

  @Get()
  @RequirePermission('cases:read')
  evaluate(
    @Req() req: Request,
    @Query('caseId') caseId: string,
    @Query('planId') planId?: string,
  ) {
    const { organizationId } = (req as any).user as { organizationId: string };
    return this.gate.evaluate(caseId, organizationId, planId);
  }
}
