import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

declare module 'express' {
  interface Request {
    correlationId: string;
  }
}

/**
 * Every request gets a correlation id — from the caller's
 * X-Correlation-Id header if present (lets a frontend or another
 * service propagate its own trace id), otherwise generated here. Echoed
 * back in the response header and in every error body
 * (see filters/all-exceptions.filter.ts) and audit log row.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header('x-correlation-id');
    req.correlationId = incoming && incoming.length > 0 ? incoming : randomUUID();
    res.setHeader('x-correlation-id', req.correlationId);
    next();
  }
}
