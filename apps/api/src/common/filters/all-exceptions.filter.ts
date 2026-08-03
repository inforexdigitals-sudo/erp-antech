import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  correlationId: string;
  details?: unknown;
}

/**
 * Normalizes every thrown error — HttpException, Prisma errors, or an
 * unexpected bug — into the single error shape documented in
 * docs/phase-3-system-architecture/api-architecture.md §4. Nothing
 * leaks a raw stack trace or Prisma internals to the client; those go
 * to the server log only, keyed by correlationId so a bug report can
 * still be traced.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = request.correlationId ?? 'unknown';

    const body = this.toErrorBody(exception, correlationId);

    if (body.statusCode >= 500) {
      this.logger.error(
        `[${correlationId}] ${request.method} ${request.url} -> ${body.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toErrorBody(exception: unknown, correlationId: string): ErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : ((payload as { message?: string | string[] }).message ?? exception.message);
      return {
        statusCode: status,
        error: exception.name.replace(/Exception$/, '').toUpperCase(),
        message: Array.isArray(message) ? message.join('; ') : message,
        correlationId,
        details: typeof payload === 'object' ? (payload as Record<string, unknown>).details : undefined,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrismaError(exception, correlationId);
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong on our end. If this keeps happening, quote the correlation id when you report it.',
      correlationId,
    };
  }

  private fromPrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
    correlationId: string,
  ): ErrorBody {
    switch (exception.code) {
      case 'P2002': // unique constraint
        return {
          statusCode: HttpStatus.CONFLICT,
          error: 'CONFLICT',
          message: `A record with this ${(exception.meta?.target as string[] | undefined)?.join(', ') ?? 'value'} already exists.`,
          correlationId,
        };
      case 'P2025': // record not found (update/delete on missing row)
        return {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'NOT_FOUND',
          message: 'Record not found.',
          correlationId,
        };
      case 'P2003': // FK violation
        return {
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          error: 'VALIDATION_ERROR',
          message: 'This references a record that does not exist.',
          correlationId,
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'DATABASE_ERROR',
          message: 'A database error occurred.',
          correlationId,
        };
    }
  }
}
