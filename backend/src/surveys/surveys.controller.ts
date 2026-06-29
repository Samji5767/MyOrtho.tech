import { Controller, Get, Post, Body, Param, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { SurveysService } from './surveys.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/surveys')
@UseGuards(AuthGuard)
export class SurveysController {
  constructor(private readonly svc: SurveysService) {}

  @Get()
  list(@Req() req: Request) { return this.svc.listSurveys(getUser(req).orgId); }

  @Post()
  create(@Req() req: Request, @Body() body: { title: string; questions: { id: string; type: string; label: string; options?: string[]; required?: boolean }[] }) {
    const { id, orgId } = getUser(req);
    return this.svc.createSurvey(orgId, id, body as Parameters<SurveysService['createSurvey']>[2]);
  }

  @Get(':surveyId/responses')
  listResponses(@Req() req: Request, @Param('surveyId') surveyId: string) {
    return this.svc.listResponses(getUser(req).orgId, surveyId);
  }

  @Get(':surveyId/stats')
  stats(@Req() req: Request, @Param('surveyId') surveyId: string) {
    return this.svc.getSurveyStats(getUser(req).orgId, surveyId);
  }

  @Post(':surveyId/responses')
  submitResponse(
    @Req() req: Request,
    @Param('surveyId') surveyId: string,
    @Body() body: { patientId?: string; caseId?: string; answers: Record<string, unknown> },
  ) {
    return this.svc.submitResponse(getUser(req).orgId, surveyId, body);
  }
}
