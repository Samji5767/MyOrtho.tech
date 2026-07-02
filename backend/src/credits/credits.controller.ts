import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CreditsService } from './credits.service';

interface AuthUser { id: string; email: string; role: string; orgId: string | null; }

function getUser(req: Request): AuthUser {
  const user = (req as Request & { user?: AuthUser }).user;
  if (!user?.orgId) throw new UnauthorizedException('Authentication required');
  return user;
}

@Controller('api/credits')
@UseGuards(AuthGuard)
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get('balance')
  getBalance(@Req() req: Request) {
    return this.creditsService.getBalance(getUser(req).orgId!);
  }

  @Get('transactions')
  listTransactions(@Req() req: Request) {
    return this.creditsService.listTransactions(getUser(req).orgId!);
  }

  /** Admin / internal: grant credits to the caller's org. Requires admin or super_admin role. */
  @Post('grant')
  @HttpCode(HttpStatus.OK)
  grantCredits(
    @Req() req: Request,
    @Body() body: { amount: number; notes?: string },
  ) {
    const user = getUser(req);
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      throw new ForbiddenException('Credit grants require admin role');
    }
    return this.creditsService.addCredits(
      user.orgId!,
      body.amount,
      'admin_grant',
      body.notes,
      user.email,
    );
  }
}

@Controller('api/subscriptions')
@UseGuards(AuthGuard)
export class SubscriptionsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get('plans')
  listPlans() {
    return this.creditsService.listPlans();
  }

  @Get('active')
  getActive(@Req() req: Request) {
    return this.creditsService.getActiveSubscription(getUser(req).orgId!);
  }

  @Post('activate')
  @HttpCode(HttpStatus.OK)
  activate(
    @Req() req: Request,
    @Body() body: { planSlug: string },
  ) {
    const user = getUser(req);
    return this.creditsService.activateSubscription(user.orgId!, body.planSlug, user.email);
  }
}
