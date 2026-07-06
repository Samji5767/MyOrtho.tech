import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { IprPlannerService, type CreateIprItemDto } from './ipr-planner.service';

@Controller('api/cases/:caseId/plans/:planId/ipr')
@UseGuards(AuthGuard)
export class IprPlannerController {
  constructor(private readonly svc: IprPlannerService) {}

  @Get()
  list(
    @Param('planId') planId: string,
    @Param('caseId') caseId: string,
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const l = limit ? Math.min(500, Math.max(1, parseInt(limit, 10))) : 200;
    const o = offset ? Math.max(0, parseInt(offset, 10)) : 0;
    return this.svc.listItems(planId, caseId, req.user.orgId as string, l, o);
  }

  @Post()
  add(
    @Param('planId') planId: string,
    @Param('caseId') caseId: string,
    @Body() dto: CreateIprItemDto,
    @Request() req: any,
  ) {
    return this.svc.addItem(planId, caseId, req.user.orgId as string, dto, req.user.id as string);
  }

  @Delete(':itemId')
  remove(
    @Param('itemId') itemId: string,
    @Param('planId') planId: string,
    @Param('caseId') caseId: string,
    @Request() req: any,
  ) {
    return this.svc.deleteItem(itemId, planId, caseId, req.user.orgId as string);
  }

  @Post('recommend')
  recommend(@Param('planId') planId: string, @Param('caseId') caseId: string, @Request() req: any) {
    return this.svc.autoRecommend(planId, caseId, req.user.orgId as string, req.user.id as string);
  }

  @Post('refine')
  refine(@Param('planId') planId: string, @Param('caseId') caseId: string, @Request() req: any) {
    return this.svc.refineRecommendations(planId, caseId, req.user.orgId as string, req.user.id as string);
  }
}
