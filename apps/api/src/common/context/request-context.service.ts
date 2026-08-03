import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

/**
 * Request-scoped so it gets a fresh instance per HTTP request (Nest
 * bubbles this scope up to anything that injects it — see AuditService).
 * Exists so services don't need `@Req()` threaded through every method
 * signature just to log an IP address.
 */
@Injectable({ scope: Scope.REQUEST })
export class RequestContextService {
  constructor(@Inject(REQUEST) private readonly request: Request) {}

  get correlationId(): string {
    return this.request.correlationId ?? 'unknown';
  }

  get ipAddress(): string | undefined {
    return this.request.ip;
  }

  get userAgent(): string | undefined {
    return this.request.header('user-agent');
  }
}
