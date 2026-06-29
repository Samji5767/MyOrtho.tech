import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { TaskManagementService } from './task-management.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/tasks')
@UseGuards(AuthGuard)
export class TaskManagementController {
  constructor(private readonly svc: TaskManagementService) {}

  @Get()
  list(@Req() req: Request, @Query('caseId') caseId?: string, @Query('status') status?: string) {
    return this.svc.listTasks(getUser(req).orgId, { caseId, status });
  }

  @Get('mine')
  mine(@Req() req: Request) {
    const { id, orgId } = getUser(req);
    return this.svc.getMyTasks(orgId, id);
  }

  @Post()
  create(
    @Req() req: Request,
    @Body() body: { title: string; description?: string; assignedTo?: string; caseId?: string; patientId?: string; dueDate?: string; priority?: string },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.createTask(orgId, id, body);
  }

  @Patch(':taskId/status')
  updateStatus(@Req() req: Request, @Param('taskId') taskId: string, @Body() body: { status: string }) {
    return this.svc.updateTaskStatus(taskId, getUser(req).orgId, body.status);
  }
}
