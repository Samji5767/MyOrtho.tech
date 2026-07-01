import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AnalysisService, type SaveAnalysisDto } from './analysis.service';
import { BoltonService, type BoltonInput } from './bolton.service';

interface AuthUser { id: string; email: string; role: string; orgId: string | null }

function auth(req: Request): AuthUser {
  const user = (req as Request & { user?: AuthUser }).user;
  if (!user?.orgId) throw new UnauthorizedException('No organization context');
  return user;
}

@Controller('api/cases/:caseId/analysis')
@UseGuards(AuthGuard)
export class AnalysisController {
  constructor(
    private readonly svc: AnalysisService,
    private readonly boltonSvc: BoltonService,
  ) {}

  @Get()
  list(@Req() req: Request, @Param('caseId') caseId: string) {
    const user = auth(req);
    return this.svc.list(caseId, user.orgId!);
  }

  @Get('latest')
  latest(@Req() req: Request, @Param('caseId') caseId: string) {
    const user = auth(req);
    return this.svc.getLatest(caseId, user.orgId!);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() body: SaveAnalysisDto,
  ) {
    const user = auth(req);
    return this.svc.create(caseId, user.orgId!, user.id, body);
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Param('id') id: string,
    @Body() body: SaveAnalysisDto,
  ) {
    const user = auth(req);
    return this.svc.update(id, caseId, user.orgId!, body);
  }

  /**
   * Compute Bolton tooth-size ratios from mesiodistal width measurements.
   * Pure computation — does not persist; use POST / or PATCH /:id to save results.
   *
   * Body: { "toothMeasurements": { "11": 8.5, "21": 8.4, ... } }
   */
  @Post('bolton')
  @HttpCode(HttpStatus.OK)
  computeBolton(
    @Req() req: Request,
    @Body() body: BoltonInput,
  ) {
    auth(req); // ensures org context; caseId not used for pure computation
    return this.boltonSvc.compute(body);
  }
}
