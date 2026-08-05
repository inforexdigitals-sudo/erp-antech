import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalService } from '../../common/approval/approval.service';
import { AuditService } from '../../common/audit/audit.service';
import { CostCategory } from '../../common/constants/cost-category';
import { PaginatedResult, PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { DocumentNumberingService } from '../../common/numbering/document-numbering.service';
import { MaterialRequestsRepository } from '../procurement/material-requests.repository';
import { CostingService } from '../project-costing/project-costing.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { SuppliersRepository } from '../suppliers/suppliers.repository';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { PurchaseOrderStatus } from './purchase-order.types';
import { PurchaseOrderWithDetail, PurchaseOrdersRepository } from './purchase-orders.repository';
import { SupplierNotificationService } from './supplier-notification.service';

/** Nothing has been committed to the project cost ledger yet in any of these — that only happens on actual approval (see approveInternally) — so editing is safe. */
const EDITABLE_STATUSES: PurchaseOrderStatus[] = ['draft', 'pending_approval', 'rejected'];

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly repository: PurchaseOrdersRepository,
    private readonly suppliers: SuppliersRepository,
    private readonly projects: ProjectsRepository,
    private readonly materialRequests: MaterialRequestsRepository,
    private readonly numbering: DocumentNumberingService,
    private readonly approval: ApprovalService,
    private readonly audit: AuditService,
    private readonly supplierNotification: SupplierNotificationService,
    private readonly costing: CostingService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreatePurchaseOrderDto): Promise<PurchaseOrderWithDetail> {
    const supplier = await this.suppliers.findById(companyId, dto.supplierId);
    if (!supplier) {
      throw new BadRequestException('Supplier not found.');
    }
    if (supplier.status !== 'active') {
      throw new BadRequestException(`Supplier "${supplier.name}" is ${supplier.status} and cannot receive new POs.`);
    }

    const project = await this.projects.findById(companyId, dto.projectId);
    if (!project) {
      throw new BadRequestException('Project not found.');
    }

    if (dto.materialRequestId) {
      const materialRequest = await this.materialRequests.findById(companyId, dto.materialRequestId);
      if (!materialRequest) {
        throw new BadRequestException('Material request not found.');
      }
    }

    const poNumber = await this.numbering.allocate(companyId, 'purchase_order');

    const po = await this.repository.create({
      companyId,
      poNumber,
      supplierId: dto.supplierId,
      projectId: dto.projectId,
      materialRequestId: dto.materialRequestId,
      expectedDeliveryDate: dto.expectedDeliveryDate,
      paymentTerms: dto.paymentTerms ?? supplier.paymentTerms ?? undefined,
      createdBy: actorUserId,
      taxAmount: dto.taxAmount,
      items: dto.items.map((item) => ({
        itemLibraryId: item.itemLibraryId,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: round2(item.quantity * item.unitPrice),
        costCategory: item.costCategory,
      })),
    });

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'create',
      entityType: 'purchase_order',
      entityId: po.id,
      after: po,
    });
    return po;
  }

  /** Edit action, exposed once a PO already exists — header fields and/or a full item replacement, gated to statuses where no cost has been committed to the project ledger yet. */
  async update(companyId: string, id: string, actorUserId: string, dto: UpdatePurchaseOrderDto): Promise<PurchaseOrderWithDetail> {
    const existing = await this.findOne(companyId, id);
    if (!EDITABLE_STATUSES.includes(existing.status as PurchaseOrderStatus)) {
      throw new ForbiddenException(`A purchase order in '${existing.status}' status cannot be edited.`);
    }

    const updated = await this.repository.update(companyId, id, {
      expectedDeliveryDate: dto.expectedDeliveryDate,
      paymentTerms: dto.paymentTerms,
      taxAmount: dto.taxAmount,
      items: dto.items?.map((item) => ({
        itemLibraryId: item.itemLibraryId,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: round2(item.quantity * item.unitPrice),
        costCategory: item.costCategory,
      })),
    });

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'update',
      entityType: 'purchase_order',
      entityId: id,
      before: existing,
      after: updated,
    });
    return updated;
  }

  async findOne(companyId: string, id: string): Promise<PurchaseOrderWithDetail> {
    const po = await this.repository.findById(companyId, id);
    if (!po) {
      throw new NotFoundException('Purchase order not found.');
    }
    return po;
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; projectId?: string; supplierId?: string },
  ): Promise<PaginatedResult<PurchaseOrderWithDetail>> {
    const { data, total } = await this.repository.list(companyId, query);
    return paginate(data, total, query);
  }

  /**
   * Claims the `draft` -> `pending_approval` transition atomically
   * before calling `approval.start()` — same reasoning as
   * QuotationsService.submitForApproval: without it, two concurrent
   * submits on the same draft PO could each open their own
   * `approval_request`, orphaning one forever.
   *
   * **Bug found and fixed via the frontend's end-to-end click-through**:
   * the auto-approve branch (no workflow configured for this company —
   * the common case in this dev/demo setup) updated status straight to
   * `'approved'` but never called `recordCommittedCost()`, unlike
   * `decide()`'s approved branch. A PO approved this way carried no
   * committed-cost entry at all, so a later delivery's `-amount`
   * release had nothing to net against — the costing dashboard showed
   * a permanently negative "Committed" figure instead of returning to
   * zero. Confirmed against the real `cost_transactions` table, not
   * just inferred from the code. Both branches now go through the same
   * `approveInternally()` helper so this can't drift apart again.
   */
  async submitForApproval(companyId: string, id: string, actorUserId: string): Promise<PurchaseOrderWithDetail> {
    const po = await this.findOne(companyId, id);
    if (po.status !== 'draft') {
      throw new ForbiddenException('Only a draft purchase order can be submitted for approval.');
    }

    const claimed = await this.repository.tryTransitionStatus(companyId, id, 'draft', 'pending_approval');
    if (!claimed) {
      throw new ForbiddenException('This purchase order was already submitted for approval by someone else.');
    }

    const request = await this.approval.start({
      companyId,
      module: 'purchase_order',
      entityType: 'purchase_order',
      entityId: id,
      amount: Number(po.total),
    });

    if (request.status === 'approved') {
      await this.approveInternally(companyId, id, actorUserId, po);
    }

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'submit_for_approval',
      entityType: 'purchase_order',
      entityId: id,
      after: { status: request.status === 'approved' ? 'approved' : 'pending_approval' },
    });
    return this.findOne(companyId, id);
  }

  /**
   * On approval, commits each line's cost to the project's cost ledger
   * (FR-10.3, "committed cost = approved but not-yet-received POs"),
   * grouped by cost category — one ledger row per category present on
   * the PO, not per line item, matching the granularity the costing
   * dashboard reads at. Tax is excluded from the committed amount: it
   * has no cost_category of its own to attribute to (the CHECK
   * constraint on cost_transactions.cost_category only allows
   * material/labour/equipment/subcontractor), so committed cost is a
   * small, known underestimate by the tax portion — acceptable for now,
   * flagged rather than silently absorbed into one of the categories.
   *
   * This write happens after the PO's own status transition commits,
   * not inside the same transaction — a crash between the two would
   * leave the PO approved but its commitment unrecorded. Accepted as a
   * known consistency gap for this batch (a proper fix is a saga/outbox
   * pattern); see recordDelivery for the same tradeoff on receiving.
   */
  async decide(
    companyId: string,
    id: string,
    actorUserId: string,
    decision: 'approved' | 'rejected',
    comments?: string,
  ): Promise<PurchaseOrderWithDetail> {
    const po = await this.findOne(companyId, id);
    if (po.status !== 'pending_approval') {
      throw new ForbiddenException('This purchase order is not awaiting approval.');
    }

    const openRequest = await this.approval.getOpenRequestForEntity(companyId, 'purchase_order', id);
    if (!openRequest) {
      throw new BadRequestException('No open approval request found for this purchase order.');
    }

    const result = await this.approval.decide({
      companyId,
      approvalRequestId: openRequest.id,
      actorUserId,
      decision,
      comments,
    });

    const nextStatus: PurchaseOrderStatus =
      result.status === 'approved' ? 'approved' : result.status === 'rejected' ? 'rejected' : ('pending_approval' as PurchaseOrderStatus);

    if (nextStatus === 'approved') {
      await this.approveInternally(companyId, id, actorUserId, po);
    } else {
      await this.repository.updateStatus(companyId, id, nextStatus);
    }

    return this.findOne(companyId, id);
  }

  /** Single path for "a PO just became approved," whether that happened immediately (no workflow configured) or via a real reviewer's decision — see submitForApproval's doc comment for why this was split out. */
  private async approveInternally(
    companyId: string,
    id: string,
    actorUserId: string,
    po: PurchaseOrderWithDetail,
  ): Promise<void> {
    await this.repository.updateStatus(companyId, id, 'approved', { approvedBy: actorUserId, approvedAt: new Date() });
    await this.recordCommittedCost(companyId, po);
  }

  /**
   * Found during review: `'cancelled'` has been a valid PO status
   * since Phase 2, but nothing ever transitioned a PO into it — there
   * was no way to cancel one through the API at all. That gap matters
   * more now that approval commits cost to the project ledger: an
   * approved-but-abandoned PO would leave a permanent, unreleasable
   * "committed" figure with no way to correct it.
   *
   * This only covers the safe half of that problem. Cancelling from
   * `draft` or `pending_approval` is safe because no cost has been
   * committed yet — there's nothing to reverse. Cancelling an already
   * `approved`/`issued` PO would need to release its outstanding
   * committed amount per cost category, which requires knowing how
   * much of that PO's original commitment hasn't already been released
   * by a delivery — not something the current ledger design (summed by
   * category + source, not tracked per line) can answer without a new
   * query. Deliberately not built here — throwing rather than silently
   * cancelling and leaving stale committed cost behind.
   */
  async cancel(companyId: string, id: string, actorUserId: string, reason?: string): Promise<PurchaseOrderWithDetail> {
    const po = await this.findOne(companyId, id);
    if (po.status === 'approved' || po.status === 'issued' || po.status === 'partially_received') {
      throw new ForbiddenException(
        `Cancelling a purchase order after it commits cost to the project budget (status '${po.status}') isn't supported yet — ` +
          'it would need to release the outstanding committed amount, which the ledger can\'t currently isolate per PO. ' +
          'Only draft or pending-approval purchase orders can be cancelled.',
      );
    }
    if (!['draft', 'pending_approval'].includes(po.status)) {
      throw new ForbiddenException(`A purchase order in '${po.status}' status cannot be cancelled.`);
    }

    await this.repository.updateStatus(companyId, id, 'cancelled');

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'cancel',
      entityType: 'purchase_order',
      entityId: id,
      before: { status: po.status },
      after: { status: 'cancelled', reason },
    });
    return this.findOne(companyId, id);
  }

  /** FR-5.9 — emails the supplier and flips status to 'issued'. */
  async issue(companyId: string, id: string, actorUserId: string): Promise<PurchaseOrderWithDetail> {
    const po = await this.findOne(companyId, id);
    if (po.status !== 'approved') {
      throw new ForbiddenException('Only an approved purchase order can be issued to the supplier.');
    }

    await this.supplierNotification.sendPurchaseOrder(po);
    await this.repository.updateStatus(companyId, id, 'issued', { issueDate: new Date() });

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'issue',
      entityType: 'purchase_order',
      entityId: id,
    });
    return this.findOne(companyId, id);
  }

  /**
   * FR-5.5/5.6 — partial deliveries; see purchase-orders.repository.ts
   * for the receiving/status logic and what's NOT wired up yet
   * (Inventory's stock_transactions — that module doesn't exist yet).
   *
   * Costing IS wired: each delivery both releases the committed amount
   * for what it just received (a negative 'committed' entry) and
   * records the same value as 'actual' — so committed+actual stays
   * equal to the original approved commitment as delivery progresses,
   * per cost category. See CostingService and the ledger's doc comment
   * in schema.prisma for why release-then-realize, not just add-to-actual.
   */
  async recordDelivery(
    companyId: string,
    id: string,
    actorUserId: string,
    dto: CreateDeliveryDto,
  ): Promise<PurchaseOrderWithDetail> {
    const po = await this.findOne(companyId, id);
    if (!['issued', 'partially_received'].includes(po.status)) {
      throw new ForbiddenException('Deliveries can only be recorded against an issued purchase order.');
    }

    const updated = await this.repository.recordDelivery(
      companyId,
      id,
      dto.deliveryDate,
      actorUserId,
      dto.notes,
      dto.items,
    );

    await this.releaseCommittedAndRecordActualCost(companyId, po, dto.items);

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'record_delivery',
      entityType: 'purchase_order',
      entityId: id,
      after: { status: updated.status, items: dto.items },
    });
    return updated;
  }

  private async recordCommittedCost(companyId: string, po: PurchaseOrderWithDetail): Promise<void> {
    for (const [costCategory, amount] of this.sumLineTotalsByCategory(po.items)) {
      await this.costing.record({
        companyId,
        projectId: po.projectId,
        costCategory,
        transactionType: 'committed',
        sourceType: 'purchase_order',
        sourceId: po.id,
        amount,
      });
    }
  }

  private async releaseCommittedAndRecordActualCost(
    companyId: string,
    po: PurchaseOrderWithDetail,
    deliveredItems: Array<{ purchaseOrderItemId: string; quantityReceived: number }>,
  ): Promise<void> {
    const valueByCategory = new Map<CostCategory, number>();
    for (const delivered of deliveredItems) {
      // Sourced from `po` — read *before* this delivery, but unitPrice
      // and costCategory are immutable on a PO line once created, so
      // that snapshot is safe to use here.
      const line = po.items.find((item) => item.id === delivered.purchaseOrderItemId);
      if (!line) continue; // already validated to belong to this PO inside the repository's transaction
      const category = line.costCategory as CostCategory;
      const deliveredValue = round2(delivered.quantityReceived * Number(line.unitPrice));
      valueByCategory.set(category, (valueByCategory.get(category) ?? 0) + deliveredValue);
    }

    for (const [costCategory, amount] of valueByCategory) {
      await this.costing.record({
        companyId,
        projectId: po.projectId,
        costCategory,
        transactionType: 'committed',
        sourceType: 'purchase_order',
        sourceId: po.id,
        amount: -amount,
      });
      await this.costing.record({
        companyId,
        projectId: po.projectId,
        costCategory,
        transactionType: 'actual',
        sourceType: 'purchase_order',
        sourceId: po.id,
        amount,
      });
    }
  }

  private sumLineTotalsByCategory(
    items: Array<{ costCategory: string; lineTotal: unknown }>,
  ): Map<CostCategory, number> {
    const totals = new Map<CostCategory, number>();
    for (const item of items) {
      const category = item.costCategory as CostCategory;
      totals.set(category, (totals.get(category) ?? 0) + Number(item.lineTotal));
    }
    return totals;
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
