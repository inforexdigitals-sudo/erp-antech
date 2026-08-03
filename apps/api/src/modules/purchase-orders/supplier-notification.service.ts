import { Injectable, Logger } from '@nestjs/common';
import { PurchaseOrderWithDetail } from './purchase-orders.repository';

/**
 * Stub — same shape and same reason as
 * quotations/quotation-delivery.service.ts: the endpoint contract
 * (POST /purchase-orders/:id/issue) is real, but actually emailing the
 * supplier's PDF waits for the jobs/integrations batch.
 */
@Injectable()
export class SupplierNotificationService {
  private readonly logger = new Logger(SupplierNotificationService.name);

  async sendPurchaseOrder(po: PurchaseOrderWithDetail): Promise<{ sentAt: Date; reference: string }> {
    this.logger.warn(
      `STUB: would render PO PDF and email it to ${po.supplier.name} for ${po.poNumber} — no PDF/email integration wired up yet.`,
    );
    return { sentAt: new Date(), reference: `stub-${po.id}` };
  }
}
