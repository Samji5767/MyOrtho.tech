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
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { AuditService } from '../audit/audit.service';

class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}

class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  clinicName: string;
}

const COOKIE_NAME = 'mo_session';

function cookieOptions(maxAgeMs: number, production: boolean) {
  return {
    httpOnly: true,
    secure: production,
    sameSite: 'strict' as const,
    maxAge: maxAgeMs,
    path: '/',
  };
}

function getIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
}

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = getIp(req);
    if (!(await this.authService.checkRateLimit(ip))) {
      await this.auditService.log({
        resourceType: 'auth',
        action: 'auth.rate_limited',
        actorEmail: body.email,
        ipAddress: ip,
      });
      throw new HttpException('Too many login attempts. Please wait a minute.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const { email, password } = body;
    if (!email || !password) {
      throw new UnauthorizedException('Email and password are required');
    }

    let payload;
    try {
      payload = await this.authService.login(email, password);
    } catch (err) {
      await this.auditService.log({
        resourceType: 'auth',
        action: 'auth.login_failed',
        actorEmail: email,
        ipAddress: ip,
        details: { reason: 'invalid_credentials' },
      });
      throw err;
    }

    const token = this.authService.signToken(payload);
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie(COOKIE_NAME, token, cookieOptions(this.authService.cookieMaxAgeMs, isProduction));

    await this.auditService.log({
      organizationId: payload.orgId,
      actorId: payload.sub,
      actorEmail: payload.email,
      resourceType: 'auth',
      action: 'auth.login',
      ipAddress: ip,
      details: { role: payload.role },
    });

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
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookieToken = (req.cookies as Record<string, string>)[COOKIE_NAME];
    const authHeader = req.headers.authorization as string | undefined;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const token = cookieToken ?? bearerToken;

    if (token) {
      try {
        const payload = await this.authService.verifyToken(token);
        if (payload.jti) {
          // exp is in seconds; convert to ms for revokeToken
          const exp = (payload as any).exp;
          await this.authService.revokeToken(payload.jti, exp ? exp * 1000 : Date.now() + 86400_000);
        }
        await this.auditService.log({
          organizationId: payload.orgId,
          actorId: payload.sub,
          actorEmail: payload.email,
          resourceType: 'auth',
          action: 'auth.logout',
          ipAddress: getIp(req),
        });
      } catch {
        // Token already invalid or expired — still clear the cookie
      }
    }

    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict' as const,
      path: '/',
    });
    return { ok: true };
  }

  @Get('session')
  async session(@Req() req: Request) {
    const cookieToken = (req.cookies as Record<string, string>)[COOKIE_NAME];
    const authHeader = req.headers.authorization as string | undefined;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const token = cookieToken ?? bearerToken;
    if (!token) throw new UnauthorizedException('No session');
    const payload = await this.authService.verifyToken(token);
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

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() body: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = getIp(req);
    if (!(await this.authService.checkRateLimit(ip))) {
      await this.auditService.log({
        resourceType: 'auth',
        action: 'auth.rate_limited',
        actorEmail: body.email,
        ipAddress: ip,
      });
      throw new HttpException('Too many registration attempts. Please wait a minute.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const { email, password, fullName, clinicName } = body;
    if (!email || !password || !fullName || !clinicName) {
      throw new HttpException('email, password, fullName and clinicName are required', HttpStatus.BAD_REQUEST);
    }
    if (password.length < 8) {
      throw new HttpException('Password must be at least 8 characters', HttpStatus.BAD_REQUEST);
    }

    const payload = await this.authService.register(email, password, fullName, clinicName);
    const token = this.authService.signToken(payload);
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie(COOKIE_NAME, token, cookieOptions(this.authService.cookieMaxAgeMs, isProduction));

    await this.auditService.log({
      organizationId: payload.orgId,
      actorId: payload.sub,
      actorEmail: payload.email,
      resourceType: 'auth',
      action: 'auth.register',
      ipAddress: getIp(req),
      details: { clinicName },
    });

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

  @Post('onboarding')
  @HttpCode(HttpStatus.OK)
  async onboarding(
    @Req() req: Request,
    @Body() body: Record<string, unknown>,
  ) {
    const token = (req.cookies as Record<string, string>)[COOKIE_NAME];
    if (!token) throw new UnauthorizedException('No session');
    const payload = await this.authService.verifyToken(token);
    await this.authService.markOnboarded(payload.sub);
    return { ok: true, role: payload.role };
  }
}

// GET /api/me — convenience alias for session (used by frontend app shell)
@Controller('api')
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  async me(@Req() req: Request) {
    const cookieToken = (req.cookies as Record<string, string>)[COOKIE_NAME];
    const authHeader = req.headers.authorization as string | undefined;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const token = cookieToken ?? bearerToken;
    if (!token) throw new UnauthorizedException('No session');
    const payload = await this.authService.verifyToken(token);
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
