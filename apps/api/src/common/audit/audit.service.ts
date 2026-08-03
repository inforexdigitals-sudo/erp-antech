import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RequestContextService } from '../context/request-context.service';

export interface RecordAuditParams {
  companyId: string;
  actorUserId?: string;
  actorPortalAccountId?: string;
  action: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'login' | 'logout' | string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
}

/**
 * Called explicitly by services at the point of mutation — not by a
 * generic interceptor — because only the service actually has the
 * before/after entity state (it just read or wrote the row via
 * Prisma). Request-scoped by extension, since it depends on
 * RequestContextService; Nest instantiates a fresh one per request.
 */
@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: RequestContextService,
  ) {}

  async record(params: RecordAuditParams): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        companyId: params.companyId,
        actorUserId: params.actorUserId,
        actorPortalAccountId: params.actorPortalAccountId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        beforeData: toJsonInput(params.before),
        afterData: toJsonInput(params.after),
        ipAddress: this.context.ipAddress,
        userAgent: this.context.userAgent,
      },
    });
  }

  /** FR-1.9's activity-feed half — used by the Dashboard module. AuditService is the natural owner of reads against audit_logs, same as every other module's repository owns reads against its own table. */
  async listRecent(companyId: string, limit: number) {
    return this.prisma.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { actorUser: { select: { id: true, fullName: true } } },
    });
  }
}

/** Prisma's JsonValue rejects `undefined` — normalize to Prisma.JsonNull semantics instead. */
function toJsonInput(value: unknown): object | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as object;
}
