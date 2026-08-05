import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, PurchaseOrder } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { PurchaseOrderStatus } from './purchase-order.types';

const poDetailInclude = {
  items: true,
  supplier: { select: { id: true, name: true, paymentTerms: true } },
  project: { select: { id: true, name: true, projectNumber: true } },
  deliveries: { include: { items: true }, orderBy: { deliveryDate: 'desc' } },
} satisfies Prisma.PurchaseOrderInclude;

export type PurchaseOrderWithDetail = Prisma.PurchaseOrderGetPayload<{ include: typeof poDetailInclude }>;

export interface CreatePurchaseOrderParams {
  companyId: string;
  poNumber: string;
  supplierId: string;
  projectId: string;
  materialRequestId?: string;
  expectedDeliveryDate?: string;
  paymentTerms?: string;
  createdBy: string;
  taxAmount: number;
  items: Array<{
    itemLibraryId?: string;
    description: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    costCategory: string;
  }>;
}

@Injectable()
export class PurchaseOrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: CreatePurchaseOrderParams): Promise<PurchaseOrderWithDetail> {
    const subtotal = round2(params.items.reduce((sum, item) => sum + item.lineTotal, 0));
    const total = round2(subtotal + params.taxAmount);

    const po = await this.prisma.purchaseOrder.create({
      data: {
        companyId: params.companyId,
        poNumber: params.poNumber,
        supplierId: params.supplierId,
        projectId: params.projectId,
        materialRequestId: params.materialRequestId,
        expectedDeliveryDate: params.expectedDeliveryDate ? new Date(params.expectedDeliveryDate) : undefined,
        paymentTerms: params.paymentTerms,
        createdBy: params.createdBy,
        status: 'draft',
        subtotal,
        taxAmount: params.taxAmount,
        total,
        items: {
          create: params.items.map((item) => ({
            itemLibraryId: item.itemLibraryId,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            costCategory: item.costCategory,
          })),
        },
      },
      include: poDetailInclude,
    });

    return po;
  }

  /**
   * Header + full item replacement in one call — a PO has no revision
   * history the way Quotations do, so an edit just overwrites the
   * current line items rather than versioning them. Safe only while
   * nothing downstream references the old item rows yet (no deliveries
   * — see PurchaseOrdersService.update's status guard), since
   * `items: { deleteMany: {}, create: [...] }` reassigns new ids.
   */
  async update(
    companyId: string,
    id: string,
    params: {
      expectedDeliveryDate?: string;
      paymentTerms?: string;
      taxAmount?: number;
      items?: Array<{
        itemLibraryId?: string;
        description: string;
        unit: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        costCategory: string;
      }>;
    },
  ): Promise<PurchaseOrderWithDetail> {
    const existing = await this.prisma.purchaseOrder.findFirstOrThrow({ where: { id, companyId } });
    const taxAmount = params.taxAmount ?? Number(existing.taxAmount);
    const subtotal = params.items
      ? round2(params.items.reduce((sum, item) => sum + item.lineTotal, 0))
      : Number(existing.subtotal);
    const total = round2(subtotal + taxAmount);

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        expectedDeliveryDate: params.expectedDeliveryDate ? new Date(params.expectedDeliveryDate) : undefined,
        paymentTerms: params.paymentTerms,
        taxAmount,
        subtotal,
        total,
        ...(params.items
          ? {
              items: {
                deleteMany: {},
                create: params.items.map((item) => ({
                  itemLibraryId: item.itemLibraryId,
                  description: item.description,
                  unit: item.unit,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  lineTotal: item.lineTotal,
                  costCategory: item.costCategory,
                })),
              },
            }
          : {}),
      },
      include: poDetailInclude,
    });
  }

  async findById(companyId: string, id: string): Promise<PurchaseOrderWithDetail | null> {
    return this.prisma.purchaseOrder.findFirst({
      where: { id, companyId },
      include: poDetailInclude,
    });
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; projectId?: string; supplierId?: string },
  ): Promise<{ data: PurchaseOrderWithDetail[]; total: number }> {
    const where: Prisma.PurchaseOrderWhereInput = {
      companyId,
      status: query.status,
      projectId: query.projectId,
      supplierId: query.supplierId,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.findMany({
        where,
        include: poDetailInclude,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);
    return { data, total };
  }

  async updateStatus(
    companyId: string,
    id: string,
    status: PurchaseOrderStatus,
    extra: Partial<{ approvedBy: string; approvedAt: Date; issueDate: Date }> = {},
  ): Promise<PurchaseOrder> {
    return this.prisma.purchaseOrder.update({ where: { id, companyId }, data: { status, ...extra } });
  }

  /**
   * Atomically transitions status only if it's still `fromStatus` at
   * write time — see PurchaseOrdersService.submitForApproval and the
   * identical method on QuotationsRepository for why this exists.
   */
  async tryTransitionStatus(
    companyId: string,
    id: string,
    fromStatus: PurchaseOrderStatus,
    toStatus: PurchaseOrderStatus,
  ): Promise<boolean> {
    const result = await this.prisma.purchaseOrder.updateMany({
      where: { id, companyId, status: fromStatus },
      data: { status: toStatus },
    });
    return result.count === 1;
  }

  /**
   * Records a delivery, increments each line's quantityReceived, and
   * flips PO status to 'partially_received' or 'received' depending on
   * whether every line is now fully received — all inside one
   * transaction so the delivery, its items, and the PO/line status
   * either all land or none do.
   *
   * The over-receipt guard is folded into the increment itself as one
   * atomic conditional `updateMany` per line (`quantityReceived: {
   * lte: <remaining outstanding> }` in the same call as the
   * `increment`), rather than reading quantityReceived once and
   * comparing before writing. Interactive Prisma transactions run at
   * Postgres's default Read Committed isolation, so a plain read at
   * the top of the transaction is NOT a stable snapshot — two
   * concurrent deliveries against the same line could each read "40 of
   * 100 received, I can add 60" and both proceed, jointly over-receiving
   * to 160. Guarding the WHERE clause against the row's state *at write
   * time* closes that: only one concurrent claim can succeed per line.
   *
   * Does NOT write to Inventory (stock_transactions) or Project
   * Costing (cost_transactions) — those modules don't exist yet in
   * this batch. FR-5.6/FR-10.2 need that wiring once Inventory and
   * Costing are built; see apps/api/README.md.
   */
  async recordDelivery(
    companyId: string,
    purchaseOrderId: string,
    deliveryDate: string,
    receivedBy: string,
    notes: string | undefined,
    items: Array<{ purchaseOrderItemId: string; quantityReceived: number; warehouseId?: string }>,
  ): Promise<PurchaseOrderWithDetail> {
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirstOrThrow({
        where: { id: purchaseOrderId, companyId },
        include: { items: true, deliveries: true },
      });

      // Delivery numbers are scoped to their PO (PO-0041-D1, -D2, ...)
      // rather than drawn from the shared document_numbering_sequences
      // table — po_deliveries.delivery_number has no CHECK-constrained
      // document_type of its own (db/migrations/0005), and sub-numbering
      // under the parent PO is the natural scheme anyway.
      const deliveryNumber = `${po.poNumber}-D${po.deliveries.length + 1}`;

      for (const deliveredItem of items) {
        const poItem = po.items.find((i) => i.id === deliveredItem.purchaseOrderItemId);
        if (!poItem) {
          throw new BadRequestException(
            `Purchase order item ${deliveredItem.purchaseOrderItemId} does not belong to this purchase order.`,
          );
        }

        // quantity (ordered) is immutable once a PO is created, so
        // reading it from the top-of-transaction snapshot is safe —
        // only quantityReceived is mutable and needs the atomic guard.
        const maxPriorReceived = Number(poItem.quantity) - deliveredItem.quantityReceived;
        const claim = await tx.purchaseOrderItem.updateMany({
          where: {
            id: deliveredItem.purchaseOrderItemId,
            purchaseOrderId,
            quantityReceived: { lte: maxPriorReceived },
          },
          data: { quantityReceived: { increment: deliveredItem.quantityReceived } },
        });
        if (claim.count === 0) {
          throw new BadRequestException(
            `Cannot receive ${deliveredItem.quantityReceived} of "${poItem.description}" — exceeds the remaining outstanding quantity (possibly due to a concurrent delivery).`,
          );
        }
      }

      // Re-read post-increment: safe now, since these reflect what this
      // transaction just atomically committed to, not a stale snapshot.
      const deliveredLineIds = items.map((i) => i.purchaseOrderItemId);
      const deliveredLines = await tx.purchaseOrderItem.findMany({ where: { id: { in: deliveredLineIds } } });
      // "Complete" means *this delivery's own lines* are now fully
      // received, not that it happens to cover every line on the PO —
      // a delivery of 5-of-10 units on all lines is still partial.
      const deliveryIsComplete = deliveredLines.every((item) => Number(item.quantityReceived) >= Number(item.quantity));

      await tx.poDelivery.create({
        data: {
          purchaseOrderId,
          deliveryNumber,
          deliveryDate: new Date(deliveryDate),
          receivedBy,
          notes,
          status: deliveryIsComplete ? 'complete' : 'partial',
          items: {
            create: items.map((item) => ({
              purchaseOrderItemId: item.purchaseOrderItemId,
              quantityReceived: item.quantityReceived,
              warehouseId: item.warehouseId,
            })),
          },
        },
      });

      const allItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId } });
      const allFullyReceived = allItems.every((item) => Number(item.quantityReceived) >= Number(item.quantity));
      const anyReceived = allItems.some((item) => Number(item.quantityReceived) > 0);
      const nextStatus: PurchaseOrderStatus = allFullyReceived
        ? 'received'
        : anyReceived
          ? 'partially_received'
          : (po.status as PurchaseOrderStatus);

      await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status: nextStatus } });

      return tx.purchaseOrder.findUniqueOrThrow({ where: { id: purchaseOrderId }, include: poDetailInclude });
    });
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
