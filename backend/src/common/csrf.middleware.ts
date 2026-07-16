import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

const CSRF_COOKIE = 'XSRF-TOKEN';
const CSRF_HEADER = 'x-csrf-token';
const SESSION_COOKIE = 'mo_session';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Webhook paths signed by the provider's own secret — no CSRF needed.
const EXEMPT_PREFIXES = ['/api/billing/webhook', '/api/webhooks'];

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const cookies = req.cookies as Record<string, string>;

    // Refresh/set the XSRF-TOKEN cookie on every response.
    const existing = cookies[CSRF_COOKIE];
    const token =
      existing && existing.length >= 32
        ? existing
        : crypto.randomBytes(20).toString('hex');

    if (!existing || existing !== token) {
      res.cookie(CSRF_COOKIE, token, {
        httpOnly: false, // must be readable by frontend JS
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }

    // Only validate on state-mutating requests.
    if (!MUTATING_METHODS.has(req.method.toUpperCase())) {
      return next();
    }

    // Webhook paths carry their own provider-level auth.
    const reqPath = req.path ?? '';
    if (EXEMPT_PREFIXES.some((p) => reqPath.startsWith(p))) {
      return next();
    }

    // Programmatic API clients authenticate with Bearer only (no session cookie).
    // They cannot be the victim of a cross-site request forgery so skip CSRF.
    const authHeader = req.headers.authorization as string | undefined;
    const hasBearer = authHeader?.startsWith('Bearer ');
    const hasSession = Boolean(cookies[SESSION_COOKIE]);
    if (hasBearer && !hasSession) {
      return next();
    }

    // Double-submit validation: header must match cookie.
    const headerToken = req.headers[CSRF_HEADER] as string | undefined;
    if (!headerToken || headerToken !== token) {
      throw new ForbiddenException('CSRF token mismatch');
    }

    return next();
  }
}
