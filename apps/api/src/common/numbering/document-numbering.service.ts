import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

/** Matches the CHECK constraint on document_numbering_sequences.document_type (0001). */
export type DocumentType =
  | 'quotation'
  | 'purchase_request'
  | 'rfq'
  | 'purchase_order'
  | 'material_request'
  | 'claim'
  | 'variation_order'
  | 'invoice'
  | 'stock_transfer'
  | 'project';

const DEFAULT_PREFIX: Record<DocumentType, string> = {
  quotation: 'QT',
  purchase_request: 'PR',
  rfq: 'RFQ',
  purchase_order: 'PO',
  material_request: 'MR',
  claim: 'CLM',
  variation_order: 'VO',
  invoice: 'INV',
  stock_transfer: 'ST',
  project: 'PRJ',
};

/**
 * Allocates the next number in a company+document-type sequence
 * (db/migrations/0001, document_numbering_sequences) — e.g. QT-0142.
 *
 * Concurrency-safe without an explicit lock: `upsert` with
 * `nextNumber: { increment: 1 }` compiles to a single atomic
 * `INSERT ... ON CONFLICT DO UPDATE SET next_number = next_number + 1`
 * at the Postgres level, so two simultaneous callers can never be
 * handed the same number.
 */
@Injectable()
export class DocumentNumberingService {
  constructor(private readonly prisma: PrismaService) {}

  async allocate(companyId: string, documentType: DocumentType): Promise<string> {
    const prefix = DEFAULT_PREFIX[documentType];

    const sequence = await this.prisma.documentNumberingSequence.upsert({
      where: { companyId_documentType: { companyId, documentType } },
      create: { companyId, documentType, prefix, nextNumber: 2, padding: 4 },
      update: { nextNumber: { increment: 1 } },
    });

    // The row we just wrote already points at the *next* number to
    // hand out — ours is one behind that, on both the create and
    // update branch (see the docstring above).
    const allocatedNumber = sequence.nextNumber - 1;
    const padded = String(allocatedNumber).padStart(sequence.padding, '0');
    return `${sequence.prefix}-${padded}`;
  }
}
