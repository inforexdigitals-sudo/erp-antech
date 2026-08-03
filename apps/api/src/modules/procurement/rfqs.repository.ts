import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RfqStatus } from './rfq.types';

const rfqDetailInclude = {
  items: true,
  recipients: { include: { supplier: { select: { id: true, name: true } } } },
  responses: { include: { items: true, supplier: { select: { id: true, name: true } } } },
  project: { select: { id: true, name: true, projectNumber: true } },
  materialRequest: { select: { id: true, requestNumber: true } },
  creator: { select: { id: true, fullName: true } },
} satisfies Prisma.RfqInclude;

export type RfqWithDetail = Prisma.RfqGetPayload<{ include: typeof rfqDetailInclude }>;

export interface RfqItemInput {
  itemLibraryId?: string;
  description: string;
  unit: string;
  quantity: number;
}

export interface CreateRfqParams {
  companyId: string;
  rfqNumber: string;
  materialRequestId?: string;
  projectId?: string;
  dueDate?: Date;
  createdBy: string;
  items: RfqItemInput[];
  supplierIds?: string[];
}

export interface RecordRfqResponseItemInput {
  rfqItemId: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

@Injectable()
export class RfqsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: CreateRfqParams): Promise<RfqWithDetail> {
    return this.prisma.rfq.create({
      data: {
        companyId: params.companyId,
        rfqNumber: params.rfqNumber,
        materialRequestId: params.materialRequestId,
        projectId: params.projectId,
        status: 'draft',
        dueDate: params.dueDate,
        createdBy: params.createdBy,
        items: { create: params.items },
        recipients: params.supplierIds?.length
          ? { create: params.supplierIds.map((supplierId) => ({ supplierId, status: 'pending' })) }
          : undefined,
      },
      include: rfqDetailInclude,
    });
  }

  async findById(companyId: string, id: string): Promise<RfqWithDetail | null> {
    return this.prisma.rfq.findFirst({ where: { id, companyId }, include: rfqDetailInclude });
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; projectId?: string },
  ): Promise<{ data: RfqWithDetail[]; total: number }> {
    const where: Prisma.RfqWhereInput = { companyId, status: query.status, projectId: query.projectId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.rfq.findMany({
        where,
        include: rfqDetailInclude,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.rfq.count({ where }),
    ]);
    return { data, total };
  }

  async addRecipients(rfqId: string, supplierIds: string[]): Promise<void> {
    // skipDuplicates: re-adding a supplier already invited is a no-op,
    // not an error — matches rfq_recipients' UNIQUE(rfq_id, supplier_id).
    await this.prisma.rfqRecipient.createMany({
      data: supplierIds.map((supplierId) => ({ rfqId, supplierId, status: 'pending' })),
      skipDuplicates: true,
    });
  }

  async markRecipientsSent(rfqId: string): Promise<void> {
    await this.prisma.rfqRecipient.updateMany({
      where: { rfqId, status: 'pending' },
      data: { status: 'sent', sentAt: new Date() },
    });
  }

  async updateStatus(companyId: string, id: string, status: RfqStatus): Promise<void> {
    await this.prisma.rfq.update({ where: { id, companyId }, data: { status } });
  }

  /** See VariationOrdersRepository.tryTransitionStatus for why this exists. */
  async tryTransitionStatus(companyId: string, id: string, fromStatus: RfqStatus, toStatus: RfqStatus): Promise<boolean> {
    const result = await this.prisma.rfq.updateMany({ where: { id, companyId, status: fromStatus }, data: { status: toStatus } });
    return result.count === 1;
  }

  /**
   * upsert on the (rfq_id, supplier_id) UNIQUE so a supplier resubmitting
   * a response replaces their prior one rather than erroring or leaving
   * a stale duplicate — a transaction because the response header and
   * its items are otherwise two separate writes.
   */
  async recordResponse(
    rfqId: string,
    supplierId: string,
    totalAmount: number,
    leadTimeDays: number | undefined,
    notes: string | undefined,
    items: RecordRfqResponseItemInput[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const response = await tx.rfqResponse.upsert({
        where: { rfqId_supplierId: { rfqId, supplierId } },
        create: { rfqId, supplierId, totalAmount, leadTimeDays, notes },
        update: { totalAmount, leadTimeDays, notes, submittedAt: new Date() },
      });
      await tx.rfqResponseItem.deleteMany({ where: { rfqResponseId: response.id } });
      await tx.rfqResponseItem.createMany({ data: items.map((item) => ({ ...item, rfqResponseId: response.id })) });
      await tx.rfqRecipient.updateMany({ where: { rfqId, supplierId }, data: { status: 'responded' } });
    });
  }

  /**
   * Closing the RFQ is the atomic guard here (not a separate
   * tryTransitionStatus check-then-write): the `status: { not: 'closed' }`
   * condition folded into this same update means only one concurrent
   * `selectResponse` call can ever win, so the unselect-all/select-one
   * that follows never races against a second selection.
   */
  async selectResponse(companyId: string, rfqId: string, responseId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.rfq.updateMany({
        where: { id: rfqId, companyId, status: { not: 'closed' } },
        data: { status: 'closed' },
      });
      if (claimed.count === 0) {
        throw new BadRequestException('This RFQ is already closed — a response was already selected.');
      }
      await tx.rfqResponse.updateMany({ where: { rfqId }, data: { isSelected: false } });
      await tx.rfqResponse.update({ where: { id: responseId }, data: { isSelected: true } });
    });
  }
}
