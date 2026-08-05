import { Injectable, NotFoundException } from '@nestjs/common';
import { CompanyRepository } from '../company/company.repository';
import { drawDocumentTitle, drawFooter, drawLetterhead, generatePdfBuffer } from '../../common/pdf/letterhead';
import { drawTable, formatMoney } from '../../common/pdf/pdf-table';
import { PurchaseOrdersService } from './purchase-orders.service';

/** Renders a Purchase Order as a letterheaded PDF — same pattern as QuotationPdfService. */
@Injectable()
export class PurchaseOrderPdfService {
  constructor(
    private readonly purchaseOrders: PurchaseOrdersService,
    private readonly companies: CompanyRepository,
  ) {}

  async generate(companyId: string, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const po = await this.purchaseOrders.findOne(companyId, id);
    const company = await this.companies.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found.');
    }
    const currency = company.baseCurrency;

    const buffer = await generatePdfBuffer((doc) => {
      let y = drawLetterhead(doc, company);
      const left = doc.page.margins.left;
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      y = drawDocumentTitle(doc, y, 'PURCHASE ORDER', po.poNumber, po.issueDate ?? po.createdAt);

      doc.fontSize(10).font('Helvetica-Bold').text('Supplier', left, y);
      y = doc.y + 2;
      doc.font('Helvetica').text(po.supplier.name, left, y);
      if (po.supplier.paymentTerms) {
        doc.text(`Payment terms: ${po.supplier.paymentTerms}`, left, doc.y);
      }
      y = doc.y + 10;

      const rightColX = left + pageWidth * 0.6;
      doc.font('Helvetica-Bold').fontSize(9).text('Project', left, y);
      doc.font('Helvetica').text(`${po.project.projectNumber} — ${po.project.name}`, left, doc.y);

      doc
        .font('Helvetica')
        .fontSize(9)
        .text(`Status: ${po.status.replace(/_/g, ' ')}`, rightColX, y, { width: pageWidth * 0.4, align: 'right' });
      if (po.expectedDeliveryDate) {
        doc.text(
          `Expected delivery: ${new Date(po.expectedDeliveryDate).toLocaleDateString('en-SG')}`,
          rightColX,
          doc.y,
          { width: pageWidth * 0.4, align: 'right' },
        );
      }
      y = Math.max(doc.y, y) + 16;

      y = drawTable(
        doc,
        left,
        y,
        [
          { header: 'Description', width: pageWidth * 0.36 },
          { header: 'Category', width: pageWidth * 0.14 },
          { header: 'Qty', width: pageWidth * 0.14, align: 'right' },
          { header: 'Unit Price', width: pageWidth * 0.18, align: 'right' },
          { header: 'Line Total', width: pageWidth * 0.18, align: 'right' },
        ],
        po.items,
        (item) => [
          item.description,
          item.costCategory,
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
      totalsRow('Subtotal', formatMoney(po.subtotal, currency));
      totalsRow('Tax', formatMoney(po.taxAmount, currency));
      doc.moveTo(totalsX, y).lineTo(totalsX + totalsWidth, y).lineWidth(0.75).strokeColor('#1a1a1a').stroke();
      y += 6;
      totalsRow('Total', formatMoney(po.total, currency), true);

      if (po.paymentTerms) {
        y += 16;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000').text('Payment Terms', left, y);
        y = doc.y + 2;
        doc.font('Helvetica').text(po.paymentTerms, left, y, { width: pageWidth });
      }

      drawFooter(doc);
    });

    return { buffer, filename: `${po.poNumber}.pdf` };
  }
}
