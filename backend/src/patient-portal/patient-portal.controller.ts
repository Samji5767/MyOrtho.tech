import { Controller, Get, Post, Patch, Body, Param, Headers, UnauthorizedException, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PatientPortalService } from './patient-portal.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/portal')
export class PatientPortalController {
  constructor(private readonly svc: PatientPortalService) {}

  // Clinician issues a magic-link token for a patient
  @UseGuards(AuthGuard)
  @Post('patients/:patientId/token')
  issueToken(@Req() req: Request, @Param('patientId') patientId: string) {
    const { orgId } = getUser(req as unknown as Request);
    return this.svc.issuePortalToken(orgId, patientId);
  }

  // Patient-facing: resolve token and get progress
  @Get('progress')
  async getProgress(@Headers('x-portal-token') token: string) {
    if (!token) throw new UnauthorizedException('Portal token required');
    const { patientId, orgId } = await this.svc.resolvePortalToken(token);
    return this.svc.getPatientProgress(patientId, orgId);
  }

  @Get('appointments')
  async getAppointments(@Headers('x-portal-token') token: string) {
    if (!token) throw new UnauthorizedException('Portal token required');
    const { patientId, orgId } = await this.svc.resolvePortalToken(token);
    return this.svc.getPatientAppointments(patientId, orgId);
  }

  @Get('consents')
  async getPendingConsents(@Headers('x-portal-token') token: string) {
    if (!token) throw new UnauthorizedException('Portal token required');
    const { patientId, orgId } = await this.svc.resolvePortalToken(token);
    return this.svc.getPendingConsents(patientId, orgId);
  }

  @Patch('consents/:consentId/sign')
  async signConsent(
    @Headers('x-portal-token') token: string,
    @Param('consentId') consentId: string,
    @Body() body: { signatureData: string },
  ) {
    if (!token) throw new UnauthorizedException('Portal token required');
    const { patientId, orgId } = await this.svc.resolvePortalToken(token);
    return this.svc.signConsentPortal(consentId, patientId, orgId, body.signatureData);
  }
}
