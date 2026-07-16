import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ClinicalSafetyGateService } from './clinical-safety-gate.service';

@Controller('api/clinical-safety-gate')
@UseGuards(AuthGuard, PermissionsGuard)
export class ClinicalSafetyGateController {
  constructor(private readonly gate: ClinicalSafetyGateService) {}

  @Get()
  @RequirePermission('cases:read')
  evaluate(
    @Req() req: Request,
    @Query('caseId') caseId: string,
    @Query('planId') planId?: string,
  ) {
    const orgId = ((req as any).user as { orgId: string }).orgId;
    return this.gate.evaluate(caseId, orgId, planId);
  }
}
