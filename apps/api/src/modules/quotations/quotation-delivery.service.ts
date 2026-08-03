import { Injectable, Logger } from '@nestjs/common';
import { QuotationWithDetail } from './quotations.repository';

/**
 * Stub. Real implementation (PDF rendering + SMTP send, queued via
 * BullMQ per docs/phase-3-system-architecture/architecture-overview.md
 * §3) lands with the jobs/integrations infrastructure batch — not
 * built in this pass since neither Auth, Quotations' CRUD/approval
 * flow, nor Purchase Orders strictly need it to be usable end-to-end.
 * The endpoint contract (POST /quotations/:id/send) is real and
 * frontend-integrable now; only what happens behind it is a stand-in.
 */
@Injectable()
export class QuotationDeliveryService {
  private readonly logger = new Logger(QuotationDeliveryService.name);

  async sendToCustomer(quotation: QuotationWithDetail): Promise<{ sentAt: Date; reference: string }> {
    this.logger.warn(
      `STUB: would render QT PDF and email it for ${quotation.quotationNumber} — no PDF/email integration wired up yet.`,
    );
    return { sentAt: new Date(), reference: `stub-${quotation.id}` };
  }
}
