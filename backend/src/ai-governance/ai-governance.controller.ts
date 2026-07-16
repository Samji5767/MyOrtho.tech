import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AiGovernanceService } from './ai-governance.service';

interface AuthUser { id: string; role: string; orgId: string | null }

function requireAdmin(req: Request): AuthUser {
  const user = (req as Request & { user?: AuthUser }).user;
  if (!user) throw new ForbiddenException('Authentication required');
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    throw new ForbiddenException('Admin role required');
  }
  return user;
}

@Controller('api/admin/ai-audit')
@UseGuards(AuthGuard)
export class AiGovernanceController {
  constructor(private readonly svc: AiGovernanceService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
    @Query('caseId') caseId?: string,
  ) {
    const user = requireAdmin(req);
    const orgId = user.role === 'super_admin' ? null : user.orgId;
    const limit = Math.min(parseInt(limitStr ?? '50', 10) || 50, 200);
    const offset = parseInt(offsetStr ?? '0', 10) || 0;
    return this.svc.listAuditRecords(orgId, { limit, offset, caseId });
  }

  @Get('export')
  @Header('Content-Type', 'text/csv')
  async export(@Req() req: Request, @Res() res: Response) {
    const user = requireAdmin(req);
    const orgId = user.role === 'super_admin' ? null : user.orgId;
    const csv = await this.svc.exportCsv(orgId);
    const filename = `ai-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
