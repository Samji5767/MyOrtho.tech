import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PilotFeedbackService, CreateFeedbackDto, UpdateFeedbackDto } from './pilot-feedback.service';

@Controller('api/pilot-feedback')
@UseGuards(AuthGuard)
export class PilotFeedbackController {
  constructor(private readonly svc: PilotFeedbackService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: Request, @Body() dto: CreateFeedbackDto) {
    const user = (req as any).user as { id: string; organizationId: string };
    return this.svc.create(user.organizationId, user.id, dto);
  }

  @Get()
  list(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    const { organizationId } = (req as any).user as { organizationId: string };
    return this.svc.list(organizationId, status, category);
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    const { organizationId } = (req as any).user as { organizationId: string };
    return this.svc.findOne(id, organizationId);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateFeedbackDto) {
    const { organizationId } = (req as any).user as { organizationId: string };
    return this.svc.update(id, organizationId, dto);
  }
}
