import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { IprPlannerService, type CreateIprItemDto } from './ipr-planner.service';

@Controller('api/cases/:caseId/plans/:planId/ipr')
@UseGuards(AuthGuard)
export class IprPlannerController {
  constructor(private readonly svc: IprPlannerService) {}

  @Get()
  list(@Param('planId') planId: string, @Param('caseId') caseId: string, @Request() req: any) {
    return this.svc.listItems(planId, caseId, req.user.orgId as string);
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
}
