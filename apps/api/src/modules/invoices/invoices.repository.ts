import { BadRequestException, Injectable } from '@nestjs/common';
import { Invoice, Prisma } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { InvoiceStatus } from './invoice.types';

const invoiceDetailInclude = {
  project: { select: { id: true, name: true, projectNumber: true } },
  customer: { select: { id: true, name: true } },
  claim: { select: { id: true, claimNumber: true } },
  payments: { orderBy: { paymentDate: 'desc' } },
} satisfies Prisma.InvoiceInclude;

export type InvoiceWithDetail = Prisma.InvoiceGetPayload<{ include: typeof invoiceDetailInclude }>;

export interface CreateInvoiceParams {
  companyId: string;
  projectId: string;
  claimId: string;
  invoiceNumber: string;
  customerId: string;
  dueDate?: Date;
  subtotal: number;
  taxAmount: number;
  total: number;
}

@Injectable()
export class InvoicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: CreateInvoiceParams): Promise<InvoiceWithDetail> {
    return this.prisma.invoice.create({
      data: {
        companyId: params.companyId,
        projectId: params.projectId,
        claimId: params.claimId,
        invoiceNumber: params.invoiceNumber,
        customerId: params.customerId,
        status: 'draft',
        dueDate: params.dueDate,
        subtotal: params.subtotal,
        taxAmount: params.taxAmount,
        total: params.total,
      },
      include: invoiceDetailInclude,
    });
  }

  async findById(companyId: string, id: string): Promise<InvoiceWithDetail | null> {
    return this.prisma.invoice.findFirst({ where: { id, companyId }, include: invoiceDetailInclude });
  }

  /** Best-effort duplicate guard, same caveat as elsewhere: not race-proof without a DB-level UNIQUE on claim_id, which db/migrations/0011 doesn't have. */
  async findByClaimId(companyId: string, claimId: string): Promise<Invoice | null> {
    return this.prisma.invoice.findFirst({ where: { companyId, claimId } });
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; projectId?: string; customerId?: string },
  ): Promise<{ data: InvoiceWithDetail[]; total: number }> {
    const where: Prisma.InvoiceWhereInput = {
      companyId,
      status: query.status,
      projectId: query.projectId,
      customerId: query.customerId,
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: invoiceDetailInclude,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { data, total };
  }

  /** See VariationOrdersRepository.tryTransitionStatus for why this exists. */
  async tryTransitionStatus(companyId: string, id: string, fromStatus: InvoiceStatus, toStatus: InvoiceStatus): Promise<boolean> {
    const result = await this.prisma.invoice.updateMany({ where: { id, companyId, status: fromStatus }, data: { status: toStatus } });
    return result.count === 1;
  }

  /**
   * Same atomic-guard shape as PurchaseOrdersRepository.recordDelivery's
   * per-line guard: the `amountPaid: { lte: ... } ` condition folded
   * into the increment itself means a concurrent payment can never push
   * amountPaid past total, and `count === 0` means "lost the race,"
   * never silent success.
   */
  async recordPayment(
    companyId: string,
    invoiceId: string,
    amount: number,
    paymentDate: Date,
    method: string | undefined,
    reference: string | undefined,
    recordedBy: string,
  ): Promise<InvoiceWithDetail> {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, companyId } });
      if (!invoice) {
        throw new BadRequestException('Invoice not found.');
      }
      if (invoice.status === 'void') {
        throw new BadRequestException('Cannot record a payment against a void invoice.');
      }

      const maxAdditional = Number(invoice.total) - Number(invoice.amountPaid);
      if (amount > maxAdditional) {
        throw new BadRequestException(
          `Payment of ${amount} exceeds the outstanding balance of ${maxAdditional.toFixed(2)}.`,
        );
      }

      await tx.payment.create({
        data: { companyId, invoiceId, amount, paymentDate, method, reference, recordedBy },
      });

      const claimed = await tx.invoice.updateMany({
        where: { id: invoiceId, companyId, amountPaid: invoice.amountPaid },
        data: { amountPaid: { increment: amount } },
      });
      if (claimed.count === 0) {
        throw new BadRequestException('This invoice was updated concurrently — retry recording the payment.');
      }

      const newAmountPaid = Number(invoice.amountPaid) + amount;
      const newStatus: InvoiceStatus = newAmountPaid >= Number(invoice.total) ? 'paid' : 'partially_paid';
      await tx.invoice.update({ where: { id: invoiceId }, data: { status: newStatus } });

      return tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: invoiceDetailInclude });
    });
  }
}
