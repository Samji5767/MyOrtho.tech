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
import { ClinicalKnowledgeService } from './clinical-knowledge.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/clinical-knowledge')
@UseGuards(AuthGuard)
export class ClinicalKnowledgeController {
  constructor(private readonly svc: ClinicalKnowledgeService) {}

  // ─── Protocols ───────────────────────────────────────────────────────────────

  @Get('protocols')
  @UseGuards(PermissionsGuard)
  @RequirePermission('knowledge:read')
  listProtocols(
    @Req() req: Request,
    @Query('area') area?: string,
    @Query('status') status?: string,
  ) {
    const { orgId } = getUser(req);
    return this.svc.listProtocols(orgId, area, status);
  }

  @Get('protocols/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('knowledge:read')
  getProtocol(@Req() req: Request, @Param('id') id: string) {
    const { orgId } = getUser(req);
    return this.svc.getProtocol(id, orgId);
  }

  @Post('protocols')
  @UseGuards(PermissionsGuard)
  @RequirePermission('knowledge:write')
  createProtocol(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const { id, orgId } = getUser(req);
    return this.svc.createProtocol(orgId, id, {
      code: body['code'] as string,
      title: body['title'] as string,
      clinicalArea: body['clinicalArea'] as string,
      evidenceLevel: body['evidenceLevel'] as string | undefined,
      contentJson: body['contentJson'] as Record<string, unknown> | undefined,
    });
  }

  @Patch('protocols/:id/status')
  @UseGuards(PermissionsGuard)
  @RequirePermission('knowledge:write')
  updateProtocolStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    const { orgId } = getUser(req);
    return this.svc.updateProtocolStatus(id, orgId, status);
  }

  // ─── Material Libraries ───────────────────────────────────────────────────────

  @Get('materials')
  @UseGuards(PermissionsGuard)
  @RequirePermission('knowledge:read')
  listMaterials(@Req() req: Request, @Query('category') category?: string) {
    const { orgId } = getUser(req);
    return this.svc.listMaterials(orgId, category);
  }

  @Post('materials')
  @UseGuards(PermissionsGuard)
  @RequirePermission('knowledge:write')
  createMaterial(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const { id, orgId } = getUser(req);
    return this.svc.createMaterial(orgId, id, {
      name: body['name'] as string,
      category: body['category'] as string,
      manufacturer: body['manufacturer'] as string | undefined,
      sku: body['sku'] as string | undefined,
      propertiesJson: body['propertiesJson'] as Record<string, unknown> | undefined,
      compatiblePrinters: body['compatiblePrinters'] as string[] | undefined,
    });
  }

  // ─── Manufacturing Profiles ───────────────────────────────────────────────────

  @Get('manufacturing-profiles')
  @UseGuards(PermissionsGuard)
  @RequirePermission('manufacturing:read')
  listProfiles(@Req() req: Request) {
    const { orgId } = getUser(req);
    return this.svc.listProfiles(orgId);
  }

  @Post('manufacturing-profiles')
  @UseGuards(PermissionsGuard)
  @RequirePermission('manufacturing:manage')
  createProfile(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const { id, orgId } = getUser(req);
    return this.svc.createProfile(orgId, id, {
      name: body['name'] as string,
      printerModel: body['printerModel'] as string | undefined,
      resinMaterial: body['resinMaterial'] as string | undefined,
      layerHeightMm: body['layerHeightMm'] as number | undefined,
      exposureMs: body['exposureMs'] as number | undefined,
      supportsJson: body['supportsJson'] as Record<string, unknown> | undefined,
      postCureJson: body['postCureJson'] as Record<string, unknown> | undefined,
      isDefault: body['isDefault'] as boolean | undefined,
    });
  }
}
