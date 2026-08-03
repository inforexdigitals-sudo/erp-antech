import { Injectable } from '@nestjs/common';
import { Prisma, VariationOrder } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { VariationOrderStatus } from './variation-order.types';

const voDetailInclude = {
  items: true,
  revisions: { orderBy: { revisionNumber: 'desc' } },
  requester: { select: { id: true, fullName: true } },
  approver: { select: { id: true, fullName: true } },
  project: { select: { id: true, name: true, projectNumber: true } },
} satisfies Prisma.VariationOrderInclude;

export type VariationOrderWithDetail = Prisma.VariationOrderGetPayload<{ include: typeof voDetailInclude }>;

export interface VoItemInput {
  description: string;
  unit?: string;
  quantity?: number;
  unitCost?: number;
  unitPrice?: number;
  costCategory: string;
}

export interface CreateVariationOrderParams {
  companyId: string;
  projectId: string;
  voNumber: string;
  title: string;
  cause: string;
  scheduleImpactDays: number;
  requestedBy: string;
  costImpact: number;
  revenueImpact: number;
  items: VoItemInput[];
}

/**
 * Unlike quotation_items (versioned per revision), variation_order_items
 * have no revision FK of their own (db/migrations/0008) — they belong
 * directly to the VO. A "revision" here is a totals snapshot
 * (variation_order_revisions), not an immutable item set: re-pricing a
 * VO replaces its live item set and logs what the new totals were.
 */
@Injectable()
export class VariationOrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: CreateVariationOrderParams): Promise<VariationOrderWithDetail> {
    return this.prisma.$transaction(async (tx) => {
      const vo = await tx.variationOrder.create({
        data: {
          companyId: params.companyId,
          projectId: params.projectId,
          voNumber: params.voNumber,
          title: params.title,
          cause: params.cause,
          scheduleImpactDays: params.scheduleImpactDays,
          requestedBy: params.requestedBy,
          costImpact: params.costImpact,
          revenueImpact: params.revenueImpact,
          status: 'draft',
          items: { create: params.items },
        },
      });

      await tx.variationOrderRevision.create({
        data: {
          variationOrderId: vo.id,
          revisionNumber: 1,
          costImpact: params.costImpact,
          revenueImpact: params.revenueImpact,
          createdBy: params.requestedBy,
        },
      });

      return tx.variationOrder.findUniqueOrThrow({ where: { id: vo.id }, include: voDetailInclude });
    });
  }

  async findById(companyId: string, id: string): Promise<VariationOrderWithDetail | null> {
    return this.prisma.variationOrder.findFirst({ where: { id, companyId }, include: voDetailInclude });
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; projectId?: string },
  ): Promise<{ data: VariationOrderWithDetail[]; total: number }> {
    const where: Prisma.VariationOrderWhereInput = { companyId, status: query.status, projectId: query.projectId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.variationOrder.findMany({
        where,
        include: voDetailInclude,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.variationOrder.count({ where }),
    ]);
    return { data, total };
  }

  /** Replaces the live item set, recomputes header totals, and logs the new totals as the next revision. */
  async addRevision(
    companyId: string,
    id: string,
    nextRevisionNumber: number,
    items: VoItemInput[],
    costImpact: number,
    revenueImpact: number,
    notes: string | undefined,
    createdBy: string,
  ): Promise<VariationOrderWithDetail> {
    return this.prisma.$transaction(async (tx) => {
      await tx.variationOrderItem.deleteMany({ where: { variationOrderId: id } });
      await tx.variationOrderItem.createMany({ data: items.map((item) => ({ ...item, variationOrderId: id })) });

      await tx.variationOrder.update({
        where: { id, companyId },
        data: { costImpact, revenueImpact, status: 'draft' },
      });

      await tx.variationOrderRevision.create({
        data: { variationOrderId: id, revisionNumber: nextRevisionNumber, costImpact, revenueImpact, notes, createdBy },
      });

      return tx.variationOrder.findUniqueOrThrow({ where: { id }, include: voDetailInclude });
    });
  }

  async updateStatus(
    companyId: string,
    id: string,
    status: VariationOrderStatus,
    extra: Partial<{ approvedBy: string; approvedAt: Date }> = {},
  ): Promise<VariationOrder> {
    return this.prisma.variationOrder.update({ where: { id, companyId }, data: { status, ...extra } });
  }

  /** See PurchaseOrdersRepository.tryTransitionStatus / QuotationsRepository.tryTransitionStatus for why this exists. */
  async tryTransitionStatus(
    companyId: string,
    id: string,
    fromStatus: VariationOrderStatus,
    toStatus: VariationOrderStatus,
  ): Promise<boolean> {
    const result = await this.prisma.variationOrder.updateMany({
      where: { id, companyId, status: fromStatus },
      data: { status: toStatus },
    });
    return result.count === 1;
  }
}
