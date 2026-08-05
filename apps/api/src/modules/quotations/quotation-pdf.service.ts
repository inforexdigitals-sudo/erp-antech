import { Injectable, NotFoundException } from '@nestjs/common';
import { CompanyRepository } from '../company/company.repository';
import { drawDocumentTitle, drawFooter, drawLetterhead, generatePdfBuffer } from '../../common/pdf/letterhead';
import { drawTable, formatMoney } from '../../common/pdf/pdf-table';
import { QuotationsService } from './quotations.service';

/**
 * Renders a Quotation's current revision as a letterheaded PDF — see
 * apps/api/README.md's PDF export section and common/pdf/letterhead.ts.
 * A separate class from QuotationsService/QuotationDeliveryService, same
 * split as the rest of this module (one responsibility per class).
 */
@Injectable()
export class QuotationPdfService {
  constructor(
    private readonly quotations: QuotationsService,
    private readonly companies: CompanyRepository,
  ) {}

  async generate(companyId: string, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const quotation = await this.quotations.findOne(companyId, id);
    const company = await this.companies.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found.');
    }
    const currency = company.baseCurrency;

    const buffer = await generatePdfBuffer((doc) => {
      let y = drawLetterhead(doc, company);
      const left = doc.page.margins.left;
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      y = drawDocumentTitle(doc, y, 'QUOTATION', quotation.quotationNumber, quotation.createdAt);

      doc.fontSize(10).font('Helvetica-Bold').text('Bill To', left, y);
      y = doc.y + 2;
      doc.font('Helvetica').text(quotation.customer.name, left, y);
      y = doc.y + 10;

      doc.font('Helvetica-Bold').text(quotation.title, left, y, { width: pageWidth * 0.6 });
      const rightColX = left + pageWidth * 0.65;
      doc
        .font('Helvetica')
        .fontSize(9)
        .text(`Status: ${quotation.status.replace(/_/g, ' ')}`, rightColX, y, { width: pageWidth * 0.35, align: 'right' });
      if (quotation.validUntil) {
        doc.text(`Valid until: ${new Date(quotation.validUntil).toLocaleDateString('en-SG')}`, rightColX, doc.y, {
          width: pageWidth * 0.35,
          align: 'right',
        });
      }
      y = Math.max(doc.y, y) + 16;

      const rev = quotation.currentRevision;
      if (!rev) {
        doc.fontSize(10).font('Helvetica').text('No priced revision has been prepared for this quotation yet.', left, y);
        drawFooter(doc);
        return;
      }

      y = drawTable(
        doc,
        left,
        y,
        [
          { header: 'Description', width: pageWidth * 0.4 },
          { header: 'Category', width: pageWidth * 0.15 },
          { header: 'Qty', width: pageWidth * 0.12, align: 'right' },
          { header: 'Unit Price', width: pageWidth * 0.16, align: 'right' },
          { header: 'Line Total', width: pageWidth * 0.17, align: 'right' },
        ],
        rev.items,
        (item) => [
          item.description,
          item.category,
          `${Number(item.quantity)} ${item.unit}`,
          formatMoney(item.unitPrice, currency),
          formatMoney(item.lineTotal, currency),
        ],
      );

      y += 10;
      const totalsX = left + pageWidth * 0.6;
      const totalsWidth = pageWidth * 0.4;
      const totalsRow = (label: string, value: string, bold = false): void => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
        doc.text(label, totalsX, y, { width: totalsWidth * 0.5, align: 'left' });
        doc.text(value, totalsX + totalsWidth * 0.5, y, { width: totalsWidth * 0.5, align: 'right' });
        y += 14;
      };
      totalsRow('Subtotal', formatMoney(rev.subtotal, currency));
      totalsRow('Discount', `-${formatMoney(rev.discountAmount, currency)}`);
      totalsRow('Tax', formatMoney(rev.taxAmount, currency));
      doc.moveTo(totalsX, y).lineTo(totalsX + totalsWidth, y).lineWidth(0.75).strokeColor('#1a1a1a').stroke();
      y += 6;
      totalsRow('Total', formatMoney(rev.total, currency), true);

      if (rev.notes) {
        y += 16;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000').text('Notes', left, y);
        y = doc.y + 2;
        doc.font('Helvetica').text(rev.notes, left, y, { width: pageWidth });
      }

      drawFooter(doc);
    });

    return { buffer, filename: `${quotation.quotationNumber}.pdf` };
  }
}
