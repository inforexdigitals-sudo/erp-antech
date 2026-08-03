import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';

/**
 * Runs after JwtAuthGuard (registration order in app.module.ts matters —
 * this guard assumes request.user is already populated). Reads the
 * @RequirePermission() metadata on the handler and checks it against
 * the permission codes embedded in the caller's access token.
 *
 * A route with no @RequirePermission() metadata is allowed through —
 * "authenticated" is the default bar; explicit permission checks are
 * opt-in per route, matching api-architecture.md's convention that
 * every mutating/sensitive route carries one.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<string | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const permissions = request.user?.permissions ?? [];

    if (!permissions.includes(requiredPermission)) {
      throw new ForbiddenException(`Missing required permission: ${requiredPermission}`);
    }
    return true;
  }
}
