import { Controller, Get, Post, Patch, Body, Param, ParseUUIDPipe, UseGuards, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { ClinicalReportsService } from './clinical-reports.service';

function markdownToHtml(md: string): string {
  return md
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/^---$/gm, '<hr>')
    .replace(/✓/g, '&#10003;')
    .replace(/⚠/g, '&#9888;')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul]|<hr|<p)(.+)$/gm, '<p>$1</p>');
}

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/cases/:caseId/reports')
@UseGuards(AuthGuard)
export class ClinicalReportsController {
  constructor(private readonly svc: ClinicalReportsService) {}

  @Get()
  list(@Req() req: Request, @Param('caseId') caseId: string) {
    const { orgId } = getUser(req);
    return this.svc.listReports(caseId, orgId);
  }

  @Post('treatment-summary')
  generateSummary(@Req() req: Request, @Param('caseId') caseId: string) {
    const { id, orgId } = getUser(req);
    return this.svc.generateTreatmentSummary(caseId, orgId, id);
  }

  @Post('aligner-progress')
  generateAlignerProgress(@Req() req: Request, @Param('caseId') caseId: string) {
    const { id, orgId } = getUser(req);
    return this.svc.generateAlignerProgressReport(caseId, orgId, id);
  }

  @Post('insurance-preauth')
  generatePreauth(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() body: { cdtCodes: string[]; estimatedFee: number; insurerId?: string },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.generateInsurancePreauth(caseId, orgId, id, body);
  }

  @Get(':reportId/download')
  async downloadReport(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('reportId') reportId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { orgId } = getUser(req);
    const report = await this.svc.getReport(reportId, orgId);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${report.title}</title>
<style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:20px;color:#1a1a1a;line-height:1.6}
h1{font-size:1.8rem;border-bottom:2px solid #333;padding-bottom:8px}
h2{font-size:1.2rem;margin-top:2rem;color:#333}
hr{border:none;border-top:1px solid #ccc;margin:1.5rem 0}
p{margin:0.5rem 0}
.disclaimer{background:#fffbeb;border:1px solid #f59e0b;padding:12px;border-radius:4px;font-size:0.9rem;margin-top:2rem}
@media print{.disclaimer{border-color:#666}}</style></head>
<body>${markdownToHtml(report.contentMarkdown ?? report.title)}<div class="disclaimer">&#9888; AI-assisted report. Final clinical decisions remain the responsibility of the licensed orthodontist.</div></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="treatment-report-${reportId.slice(0, 8)}.html"`);
    res.send(html);
  }

  @Get(':reportId')
  getReport(@Req() req: Request, @Param('reportId', new ParseUUIDPipe()) reportId: string) {
    const { orgId } = getUser(req);
    return this.svc.getReport(reportId, orgId);
  }

  @Patch(':reportId/approve')
  approve(@Req() req: Request, @Param('reportId', new ParseUUIDPipe()) reportId: string) {
    const { id, orgId } = getUser(req);
    return this.svc.approveReport(reportId, orgId, id);
  }
}
