import { Controller, Get, Post, Patch, Param, Body, Req, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CopilotService, SendMessageDto } from './copilot.service';

@Controller()
@UseGuards(AuthGuard)
export class CopilotController {
  constructor(private readonly svc: CopilotService) {}

  @Post('api/cases/:caseId/copilot/conversations')
  startConversation(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Body('planId') planId?: string,
  ) {
    return this.svc.startConversation(caseId, req.user.orgId, req.user.id, planId);
  }

  @Get('api/cases/:caseId/copilot/conversations')
  listConversations(@Req() req: any, @Param('caseId') caseId: string) {
    return this.svc.listConversations(caseId, req.user.orgId);
  }

  @Post('api/cases/:caseId/copilot/conversations/:conversationId/messages')
  sendMessage(
    @Req() req: any,
    @Param('caseId') _caseId: string,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.svc.sendMessage(conversationId, req.user.orgId, dto);
  }

  @Get('api/cases/:caseId/copilot/conversations/:conversationId/messages')
  getMessages(
    @Req() req: any,
    @Param('caseId') _caseId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.svc.getMessages(conversationId, req.user.orgId);
  }

  @Get('api/cases/:caseId/copilot/suggestions')
  listSuggestions(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Query('planId') planId?: string,
  ) {
    return this.svc.listSuggestions(caseId, req.user.orgId, planId);
  }

  @Patch('api/cases/:caseId/copilot/suggestions/:suggestionId/resolve')
  resolveSuggestion(
    @Req() req: any,
    @Param('caseId') _caseId: string,
    @Param('suggestionId') suggestionId: string,
    @Body('status') status: 'acknowledged' | 'dismissed' | 'applied',
    @Body('clinicianNote') clinicianNote?: string,
  ) {
    return this.svc.resolveSuggestion(suggestionId, req.user.orgId, req.user.id, status, clinicianNote);
  }
}
