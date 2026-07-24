import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { CasesService, CreateCaseDto, type CreateCaseWithPatientDto, type UpdateCaseDto, type PracticeAnalyticsSummary } from './cases.service';
import { AiScoresService } from './ai-scores.service';
import { DigitalTwinService } from './digital-twin.service';
import { AuthGuard, type AuthUser } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { buildScope } from '../common/access-scope';
import type { CaseStatus } from '../workflow/workflow.service';

function getUser(req: Request): AuthUser {
  const user = (req as Request & { user?: AuthUser }).user;
  if (!user) throw new UnauthorizedException('No session');
  return user;
}

function getIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
}

@Controller('api/cases')
@UseGuards(AuthGuard, PermissionsGuard)
export class CasesController {
  constructor(
    private readonly casesService: CasesService,
    private readonly aiScoresService: AiScoresService,
    private readonly digitalTwinService: DigitalTwinService,
  ) {}

  @Get()
  @RequirePermission('cases:read')
  async getCases(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('patientId') patientId?: string,
  ) {
    const user = getUser(req);
    const scope = buildScope(user);
    const l = limit ? Math.min(500, Math.max(1, parseInt(limit, 10))) : 100;
    const o = offset ? Math.max(0, parseInt(offset, 10)) : 0;
    return this.casesService.findAll(scope, l, o, patientId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('cases:write')
  async createCase(@Req() req: Request, @Body() dto: CreateCaseDto) {
    const user = getUser(req);
    const scope = buildScope(user);
    return this.casesService.createByScope(scope, user.id, dto, {
      actorEmail: user.email,
      ipAddress: getIp(req),
    });
  }

  @Post('with-new-patient')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('cases:write')
  async createCaseWithNewPatient(@Req() req: Request, @Body() dto: CreateCaseWithPatientDto) {
    const user = getUser(req);
    const scope = buildScope(user);
    return this.casesService.createWithNewPatientByScope(scope, user.id, dto, {
      actorEmail: user.email,
      ipAddress: getIp(req),
    });
  }

  @Get('analytics/summary')
  @RequirePermission('cases:read')
  async getAnalyticsSummary(@Req() req: Request): Promise<PracticeAnalyticsSummary> {
    const user = getUser(req);
    const scope = buildScope(user);
    return this.casesService.getAnalyticsSummaryByScope(scope);
  }

  @Get(':id')
  @RequirePermission('cases:read')
  async getCaseById(@Req() req: Request, @Param('id') id: string) {
    const user = getUser(req);
    const scope = buildScope(user);
    return this.casesService.findOneByScope(id, scope);
  }

  @Patch(':id')
  @RequirePermission('cases:write')
  async updateCase(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCaseDto,
  ) {
    const user = getUser(req);
    const scope = buildScope(user);
    return this.casesService.updateByScope(id, scope, user.id, dto, {
      actorEmail: user.email,
      ipAddress: getIp(req),
    });
  }

  @Post(':id/transition')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('cases:write')
  async transitionCase(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { toStatus: CaseStatus; notes?: string },
  ) {
    const user = getUser(req);
    const scope = buildScope(user);
    return this.casesService.transitionByScope(
      id, scope, user.id, user.role, body.toStatus, body.notes,
      { actorEmail: user.email, ipAddress: getIp(req) },
    );
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('cases:approve')
  async approveCase(@Req() req: Request, @Param('id') id: string, @Body() body: { notes?: string }) {
    const user = getUser(req);
    const scope = buildScope(user);
    return this.casesService.transitionByScope(
      id, scope, user.id, user.role, 'approved', body.notes,
      { actorEmail: user.email, ipAddress: getIp(req) },
    );
  }

  @Get(':id/ai-scores')
  @RequirePermission('cases:read')
  async getAiScores(@Req() req: Request, @Param('id') id: string) {
    const user = getUser(req);
    if (!user.orgId) throw new UnauthorizedException('No organization assigned');
    return this.aiScoresService.getScores(id, user.orgId);
  }

  @Get(':id/digital-twin')
  @RequirePermission('cases:read')
  async getDigitalTwin(@Req() req: Request, @Param('id') id: string) {
    const user = getUser(req);
    if (!user.orgId) throw new UnauthorizedException('No organization assigned');
    return this.digitalTwinService.getDigitalTwin(id, user.orgId);
  }
}
