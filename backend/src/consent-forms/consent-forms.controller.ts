import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { ConsentFormsService } from './consent-forms.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api')
@UseGuards(AuthGuard)
export class ConsentFormsController {
  constructor(private readonly svc: ConsentFormsService) {}

  // ─── Templates ────────────────────────────────────────────────────────────

  @Get('consent-templates')
  listTemplates(@Req() req: Request) {
    const { orgId } = getUser(req);
    return this.svc.listTemplates(orgId);
  }

  @Post('consent-templates')
  createTemplate(@Req() req: Request, @Body() body: { title: string; contentMarkdown: string; version?: string; requiresWitness?: boolean }) {
    const { orgId } = getUser(req);
    return this.svc.createTemplate(orgId, body);
  }

  // ─── Case Consents ────────────────────────────────────────────────────────

  @Get('cases/:caseId/consents')
  listConsents(@Req() req: Request, @Param('caseId') caseId: string) {
    const { orgId } = getUser(req);
    return this.svc.listConsents(caseId, orgId);
  }

  @Post('cases/:caseId/consents')
  createConsent(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() body: { templateId: string; patientName: string },
  ) {
    const { orgId } = getUser(req);
    return this.svc.createConsent(caseId, orgId, body);
  }

  @Patch('consents/:consentId/sign')
  signConsent(
    @Req() req: Request,
    @Param('consentId') consentId: string,
    @Body() body: { signatureData: string; witnessName?: string },
  ) {
    const { orgId } = getUser(req);
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? undefined;
    return this.svc.signConsent(consentId, orgId, { ...body, ipAddress: ip });
  }

  @Patch('consents/:consentId/decline')
  declineConsent(@Req() req: Request, @Param('consentId') consentId: string) {
    const { orgId } = getUser(req);
    return this.svc.declineConsent(consentId, orgId);
  }
}
