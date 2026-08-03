import { Injectable } from '@nestjs/common';
import { Prisma, Quotation } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { QuotationStatus } from './quotation.types';

const quotationDetailInclude = {
  currentRevision: { include: { items: true } },
  customer: { select: { id: true, name: true } },
  owner: { select: { id: true, fullName: true } },
} satisfies Prisma.QuotationInclude;

export type QuotationWithDetail = Prisma.QuotationGetPayload<{ include: typeof quotationDetailInclude }>;

export interface CreateQuotationHeaderParams {
  companyId: string;
  quotationNumber: string;
  customerId: string;
  leadId?: string;
  opportunityId?: string;
  ownerUserId?: string;
  title: string;
  validUntil?: string;
  createdBy: string;
}

/** Fully-formed line item ready to persist — built by QuotationsService from the DTO + quotation-pricing.util output. */
export interface RevisionItemForPersistence {
  itemLibraryId?: string;
  description: string;
  category: string;
  unit: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  markupPercent: number;
  discountPercent: number;
  taxCodeId?: string;
  lineTotal: number;
  sortOrder: number;
}

export interface RevisionForPersistence {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  items: RevisionItemForPersistence[];
}

@Injectable()
export class QuotationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createWithFirstRevision(
    header: CreateQuotationHeaderParams,
    revision: RevisionForPersistence,
    notes: string | undefined,
  ): Promise<QuotationWithDetail> {
    return this.prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.create({
        data: {
          companyId: header.companyId,
          quotationNumber: header.quotationNumber,
          customerId: header.customerId,
          leadId: header.leadId,
          opportunityId: header.opportunityId,
          ownerUserId: header.ownerUserId,
          title: header.title,
          validUntil: header.validUntil ? new Date(header.validUntil) : undefined,
          status: 'draft',
        },
      });

      const createdRevision = await tx.quotationRevision.create({
        data: {
          quotationId: quotation.id,
          revisionNumber: 1,
          subtotal: revision.subtotal,
          discountAmount: revision.discountAmount,
          taxAmount: revision.taxAmount,
          total: revision.total,
          notes,
          createdBy: header.createdBy,
          items: { create: revision.items },
        },
      });

      await tx.quotation.update({
        where: { id: quotation.id },
        data: { currentRevisionId: createdRevision.id },
      });

      return tx.quotation.findUniqueOrThrow({
        where: { id: quotation.id },
        include: quotationDetailInclude,
      });
    });
  }

  async addRevision(
    companyId: string,
    quotationId: string,
    nextRevisionNumber: number,
    revision: RevisionForPersistence,
    notes: string | undefined,
    createdBy: string,
  ): Promise<QuotationWithDetail> {
    return this.prisma.$transaction(async (tx) => {
      const createdRevision = await tx.quotationRevision.create({
        data: {
          quotationId,
          revisionNumber: nextRevisionNumber,
          subtotal: revision.subtotal,
          discountAmount: revision.discountAmount,
          taxAmount: revision.taxAmount,
          total: revision.total,
          notes,
          createdBy,
          items: { create: revision.items },
        },
      });

      await tx.quotation.update({
        where: { id: quotationId, companyId },
        data: { currentRevisionId: createdRevision.id, status: 'draft' },
      });

      return tx.quotation.findUniqueOrThrow({
        where: { id: quotationId },
        include: quotationDetailInclude,
      });
    });
  }

  async findById(companyId: string, id: string): Promise<QuotationWithDetail | null> {
    return this.prisma.quotation.findFirst({
      where: { id, companyId },
      include: quotationDetailInclude,
    });
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; customerId?: string },
  ): Promise<{ data: QuotationWithDetail[]; total: number }> {
    const where: Prisma.QuotationWhereInput = {
      companyId,
      status: query.status,
      customerId: query.customerId,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.quotation.findMany({
        where,
        include: quotationDetailInclude,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.quotation.count({ where }),
    ]);

    return { data, total };
  }

  async updateHeader(
    companyId: string,
    id: string,
    data: Partial<{ title: string; customerId: string; ownerUserId: string; validUntil: Date }>,
  ): Promise<Quotation> {
    return this.prisma.quotation.update({ where: { id, companyId }, data });
  }

  async updateStatus(companyId: string, id: string, status: QuotationStatus): Promise<Quotation> {
    return this.prisma.quotation.update({ where: { id, companyId }, data: { status } });
  }

  /**
   * Atomically transitions status only if it's still `fromStatus` at
   * write time — returns false instead of throwing so callers can
   * decide how to react. See QuotationsService.submitForApproval for
   * why this exists: without it, two concurrent submits on the same
   * draft could both pass a read-time status check and each open their
   * own approval request.
   */
  async tryTransitionStatus(
    companyId: string,
    id: string,
    fromStatus: QuotationStatus,
    toStatus: QuotationStatus,
  ): Promise<boolean> {
    const result = await this.prisma.quotation.updateMany({
      where: { id, companyId, status: fromStatus },
      data: { status: toStatus },
    });
    return result.count === 1;
  }

  /** Returns a Map of taxCodeId -> rate percent, scoped to the tenant so a caller can't reference another company's tax code. */
  async getTaxRates(companyId: string, taxCodeIds: string[]): Promise<Map<string, number>> {
    if (taxCodeIds.length === 0) return new Map();
    const taxCodes = await this.prisma.taxCode.findMany({
      where: { companyId, id: { in: taxCodeIds } },
      select: { id: true, ratePercent: true },
    });
    return new Map(taxCodes.map((t) => [t.id, Number(t.ratePercent)]));
  }
}
