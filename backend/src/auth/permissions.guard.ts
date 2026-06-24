import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSION_KEY } from './require-permission.decorator';
import { hasPermission, type Permission } from './permissions';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  name: string;
  orgId: string | null;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No permission required — allow through
    if (!required) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as Request & { user?: AuthenticatedUser }).user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (!hasPermission(user.role, required)) {
      throw new ForbiddenException(
        `Role '${user.role}' does not have permission '${required}'`,
      );
    }

    return true;
  }
}
