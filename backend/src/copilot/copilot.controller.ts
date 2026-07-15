import { Controller, Get, Post, Patch, Param, ParseUUIDPipe, Body, Req, Res, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CopilotService, SendMessageDto } from './copilot.service';
import type { AuthenticatedRequest } from '../common/auth-request.type';

@Controller()
@UseGuards(AuthGuard)
export class CopilotController {
  constructor(private readonly svc: CopilotService) {}

  @Post('api/cases/:caseId/copilot/conversations')
  startConversation(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Body('planId') planId?: string,
  ) {
    return this.svc.startConversation(caseId, req.user.orgId, req.user.id, planId);
  }

  @Get('api/cases/:caseId/copilot/conversations')
  listConversations(@Req() req: AuthenticatedRequest, @Param('caseId') caseId: string) {
    return this.svc.listConversations(caseId, req.user.orgId);
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('api/cases/:caseId/copilot/conversations/:conversationId/messages')
  sendMessage(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') _caseId: string,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.svc.sendMessage(conversationId, req.user.orgId, dto, req.user.id);
  }

  @Get('api/cases/:caseId/copilot/conversations/:conversationId/messages')
  getMessages(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') _caseId: string,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
  ) {
    return this.svc.getMessages(conversationId, req.user.orgId);
  }

  @Get('api/cases/:caseId/copilot/suggestions')
  listSuggestions(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') caseId: string,
    @Query('planId') planId?: string,
  ) {
    return this.svc.listSuggestions(caseId, req.user.orgId, planId);
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('api/cases/:caseId/copilot/conversations/:conversationId/stream')
  async streamMessage(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Param('caseId') _caseId: string,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
    @Body() dto: SendMessageDto,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');  // disable nginx buffering
    res.flushHeaders();

    try {
      for await (const event of this.svc.streamMessage(conversationId, req.user.orgId, dto, req.user.id)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: (err as Error).message })}\n\n`);
    } finally {
      res.end();
    }
  }

  @Patch('api/cases/:caseId/copilot/suggestions/:suggestionId/resolve')
  resolveSuggestion(
    @Req() req: AuthenticatedRequest,
    @Param('caseId') _caseId: string,
    @Param('suggestionId') suggestionId: string,
    @Body('status') status: 'acknowledged' | 'dismissed' | 'applied',
    @Body('clinicianNote') clinicianNote?: string,
  ) {
    return this.svc.resolveSuggestion(suggestionId, req.user.orgId, req.user.id, status, clinicianNote);
  }
}
