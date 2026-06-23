import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';

const COOKIE_NAME = 'mo_session';

function cookieOptions(maxAgeMs: number, production: boolean) {
  return {
    httpOnly: true,
    secure: production,
    sameSite: 'lax' as const,
    maxAge: maxAgeMs,
    path: '/',
  };
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: { email?: string; password?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
    if (!this.authService.checkRateLimit(ip)) {
      throw new HttpException('Too many login attempts. Please wait a minute.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const { email, password } = body;
    if (!email || !password) {
      throw new UnauthorizedException('Email and password are required');
    }

    const payload = await this.authService.login(email, password);
    const token = this.authService.signToken(payload);
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie(COOKIE_NAME, token, cookieOptions(this.authService.cookieMaxAgeMs, isProduction));

    return {
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        orgId: payload.orgId,
        isOnboarded: payload.isOnboarded,
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, { httpOnly: true, path: '/' });
    return { ok: true };
  }

  @Get('session')
  session(@Req() req: Request) {
    const token = (req.cookies as Record<string, string>)[COOKIE_NAME];
    if (!token) throw new UnauthorizedException('No session');
    const payload = this.authService.verifyToken(token);
    return {
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        orgId: payload.orgId,
        isOnboarded: payload.isOnboarded,
      },
    };
  }
}

// GET /api/me — convenience alias for session (used by frontend app shell)
@Controller('api')
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  me(@Req() req: Request) {
    const token = (req.cookies as Record<string, string>)[COOKIE_NAME];
    if (!token) throw new UnauthorizedException('No session');
    const payload = this.authService.verifyToken(token);
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      orgId: payload.orgId,
      isOnboarded: payload.isOnboarded,
    };
  }
}
