import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';

const COOKIE_NAME = 'mo_session';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const cookieToken = (request.cookies as Record<string, string>)[COOKIE_NAME];
    const authHeader = request.headers.authorization as string | undefined;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const token = cookieToken ?? bearerToken;

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    const payload = this.authService.verifyToken(token);

    // Attach user to request for downstream use
    (request as Request & { user: unknown }).user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      name: payload.name,
      orgId: payload.orgId,
    };

    return true;
  }
}
