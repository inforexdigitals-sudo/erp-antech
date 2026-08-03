import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../types/auth.types';

/**
 * Injects the authenticated user (set by JwtAuthGuard). Throws rather
 * than returning undefined — a controller using @CurrentUser() is by
 * definition behind auth, so a missing user means the guard chain is
 * misconfigured, not a legitimate anonymous case.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.user) {
      throw new UnauthorizedException('No authenticated user on request — is this route missing @UseGuards(JwtAuthGuard)?');
    }
    return request.user;
  },
);
