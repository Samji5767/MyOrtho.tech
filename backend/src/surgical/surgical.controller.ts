import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param,
  Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import {
  SurgicalService, CreateImplantPlacementDto, CreateTadPlanDto, CreateSurgicalGuideDto,
} from './surgical.service';

@Controller('api')
@UseGuards(AuthGuard)
export class SurgicalController {
  constructor(private readonly svc: SurgicalService) {}

  // ── Implant Library ────────────────────────────────────────────────────────

  @Get('implants')
  listImplants(
    @Query('manufacturer') manufacturer?: string,
    @Query('minDiameter') minDiameter?: string,
    @Query('maxDiameter') maxDiameter?: string,
  ) {
    return this.svc.listImplants({
      manufacturer,
      minDiameter: minDiameter != null ? Number(minDiameter) : undefined,
      maxDiameter: maxDiameter != null ? Number(maxDiameter) : undefined,
    });
  }

  // ── Implant Placements ─────────────────────────────────────────────────────

  @Get('cases/:caseId/surgical/placements')
  listPlacements(@Req() req: Request, @Param('caseId') caseId: string) {
    const { organizationId } = (req as unknown as { user: { organizationId: string } }).user;
    return this.svc.listPlacements(caseId, organizationId);
  }

  @Post('cases/:caseId/surgical/placements')
  @HttpCode(HttpStatus.CREATED)
  createPlacement(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() dto: CreateImplantPlacementDto,
  ) {
    const { organizationId, id: userId } = (req as unknown as { user: { organizationId: string; id: string } }).user;
    return this.svc.createPlacement(caseId, organizationId, userId, dto);
  }

  @Patch('cases/:caseId/surgical/placements/:id')
  updatePlacement(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateImplantPlacementDto>,
  ) {
    const { organizationId } = (req as unknown as { user: { organizationId: string } }).user;
    return this.svc.updatePlacement(id, caseId, organizationId, dto);
  }

  @Delete('cases/:caseId/surgical/placements/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePlacement(@Req() req: Request, @Param('caseId') caseId: string, @Param('id') id: string) {
    const { organizationId } = (req as unknown as { user: { organizationId: string } }).user;
    return this.svc.deletePlacement(id, caseId, organizationId);
  }

  // ── TAD Plans ──────────────────────────────────────────────────────────────

  @Get('cases/:caseId/surgical/tads')
  listTadPlans(@Req() req: Request, @Param('caseId') caseId: string) {
    const { organizationId } = (req as unknown as { user: { organizationId: string } }).user;
    return this.svc.listTadPlans(caseId, organizationId);
  }

  @Post('cases/:caseId/surgical/tads')
  @HttpCode(HttpStatus.CREATED)
  createTadPlan(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() dto: CreateTadPlanDto,
  ) {
    const { organizationId, id: userId } = (req as unknown as { user: { organizationId: string; id: string } }).user;
    return this.svc.createTadPlan(caseId, organizationId, userId, dto);
  }

  @Delete('cases/:caseId/surgical/tads/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTadPlan(@Req() req: Request, @Param('caseId') caseId: string, @Param('id') id: string) {
    const { organizationId } = (req as unknown as { user: { organizationId: string } }).user;
    return this.svc.deleteTadPlan(id, caseId, organizationId);
  }

  // ── Surgical Guides ────────────────────────────────────────────────────────

  @Get('cases/:caseId/surgical/guides')
  listGuides(@Req() req: Request, @Param('caseId') caseId: string) {
    const { organizationId } = (req as unknown as { user: { organizationId: string } }).user;
    return this.svc.listGuides(caseId, organizationId);
  }

  @Post('cases/:caseId/surgical/guides')
  @HttpCode(HttpStatus.CREATED)
  createGuide(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() dto: CreateSurgicalGuideDto,
  ) {
    const { organizationId, id: userId } = (req as unknown as { user: { organizationId: string; id: string } }).user;
    return this.svc.createGuide(caseId, organizationId, userId, dto);
  }

  @Post('cases/:caseId/surgical/guides/:id/export')
  @HttpCode(HttpStatus.OK)
  markGuideExported(@Req() req: Request, @Param('caseId') caseId: string, @Param('id') id: string) {
    const { organizationId } = (req as unknown as { user: { organizationId: string } }).user;
    return this.svc.markGuideExported(id, caseId, organizationId);
  }
}
