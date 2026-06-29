import { Controller, Get, Post, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { FhirService } from './fhir.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/fhir')
@UseGuards(AuthGuard)
export class FhirController {
  constructor(private readonly svc: FhirService) {}

  @Get('exports')
  listExports(@Req() req: Request, @Query('resourceType') resourceType?: string) {
    return this.svc.listExports(getUser(req).orgId, resourceType);
  }

  @Post('patients/:patientId/export')
  exportPatient(@Req() req: Request, @Param('patientId') patientId: string) {
    const { id, orgId } = getUser(req);
    return this.svc.exportPatient(orgId, patientId, id);
  }

  @Post('cases/:caseId/observation')
  exportObservation(@Req() req: Request, @Param('caseId') caseId: string) {
    const { id, orgId } = getUser(req);
    return this.svc.exportCbctObservation(orgId, caseId, id);
  }
}
