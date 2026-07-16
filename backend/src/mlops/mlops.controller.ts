import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { MlopsService } from './mlops.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/mlops')
@UseGuards(AuthGuard)
export class MlopsController {
  constructor(private readonly svc: MlopsService) {}

  // ─── Model Registry ───────────────────────────────────────────────────────────

  @Get('models')
  @UseGuards(PermissionsGuard)
  @RequirePermission('mlops:read')
  listModels(@Req() req: Request, @Query('status') status?: string) {
    const { orgId } = getUser(req);
    return this.svc.listModels(orgId, status);
  }

  @Get('models/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('mlops:read')
  getModel(@Param('id') id: string) {
    return this.svc.getModel(id);
  }

  @Post('models')
  @UseGuards(PermissionsGuard)
  @RequirePermission('mlops:manage')
  registerModel(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const { id, orgId } = getUser(req);
    return this.svc.registerModel(id, {
      name: body['name'] as string,
      modelType: body['modelType'] as string,
      version: body['version'] as string,
      provider: body['provider'] as string | undefined,
      artifactPath: body['artifactPath'] as string | undefined,
      metricsJson: body['metricsJson'] as Record<string, unknown> | undefined,
      organizationId: orgId,
    });
  }

  @Patch('models/:id/status')
  @UseGuards(PermissionsGuard)
  @RequirePermission('mlops:manage')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.svc.updateModelStatus(id, status);
  }

  // ─── Inference Audit ──────────────────────────────────────────────────────────

  @Get('inference-audit')
  @UseGuards(PermissionsGuard)
  @RequirePermission('mlops:read')
  listAudit(
    @Req() req: Request,
    @Query('caseId') caseId?: string,
    @Query('modelId') modelId?: string,
    @Query('limit') limit?: string,
  ) {
    const { orgId } = getUser(req);
    return this.svc.listInferenceAudit(orgId, {
      caseId,
      modelId,
      limit: limit ? parseInt(limit, 10) : 100,
    });
  }

  @Post('inference-audit')
  @UseGuards(PermissionsGuard)
  @RequirePermission('mlops:read')
  recordInference(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const { orgId } = getUser(req);
    return this.svc.recordInference(orgId, {
      modelName: body['modelName'] as string,
      modelVersion: body['modelVersion'] as string,
      invokedBy: body['invokedBy'] as string,
      modelId: body['modelId'] as string | undefined,
      caseId: body['caseId'] as string | undefined,
      patientId: body['patientId'] as string | undefined,
      inputHash: body['inputHash'] as string | undefined,
      outputSummary: body['outputSummary'] as string | undefined,
      latencyMs: body['latencyMs'] as number | undefined,
      tokensUsed: body['tokensUsed'] as number | undefined,
      outcome: body['outcome'] as string | undefined,
      disclaimerShown: body['disclaimerShown'] as boolean | undefined,
    });
  }

  @Get('utilization')
  @UseGuards(PermissionsGuard)
  @RequirePermission('mlops:read')
  utilizationStats(@Req() req: Request) {
    const { orgId } = getUser(req);
    return this.svc.getUtilizationStats(orgId);
  }
}
