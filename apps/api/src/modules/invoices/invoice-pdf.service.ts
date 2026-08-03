import { Injectable, NotFoundException } from '@nestjs/common';
import { ClaimsService } from '../claims/claims.service';
import { CompanyRepository } from '../company/company.repository';
import { drawFooter, drawLetterhead, generatePdfBuffer } from '../../common/pdf/letterhead';
import { drawTable, formatMoney } from '../../common/pdf/pdf-table';
import { InvoicesService } from './invoices.service';

/**
 * Renders an Invoice as a letterheaded PDF. Invoices have no line-items
 * table of their own (see InvoicesService/Prisma schema — they're billed
 * as a lump sum against a certified claim), so the itemized breakdown
 * shown here is pulled from the linked Claim's items, same as the
 * frontend would need to if it wanted the same detail.
 */
@Injectable()
export class InvoicePdfService {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly claims: ClaimsService,
    private readonly companies: CompanyRepository,
  ) {}

  async generate(companyId: string, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const invoice = await this.invoices.findOne(companyId, id);
    const company = await this.companies.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found.');
    }
    const currency = company.baseCurrency;
    const claim = invoice.claim ? await this.claims.findOne(companyId, invoice.claim.id) : null;
    const balanceDue = Number(invoice.total) - Number(invoice.amountPaid);

    const buffer = await generatePdfBuffer((doc) => {
      let y = drawLetterhead(doc, company);
      const left = doc.page.margins.left;
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      doc.fontSize(16).font('Helvetica-Bold').text('TAX INVOICE', left, y);
      doc.fontSize(10).font('Helvetica').text(invoice.invoiceNumber, left, y, { width: pageWidth, align: 'right' });
      y = doc.y + 16;

      doc.fontSize(10).font('Helvetica-Bold').text('Bill To', left, y);
      y = doc.y + 2;
      doc.font('Helvetica').text(invoice.customer.name, left, y);
      y = doc.y + 10;

      const rightColX = left + pageWidth * 0.6;
      doc.font('Helvetica-Bold').fontSize(9).text('Project', left, y);
      doc.font('Helvetica').text(`${invoice.project.projectNumber} — ${invoice.project.name}`, left, doc.y);
      if (claim) {
        doc.text(`Progress Claim: ${claim.claimNumber}`, left, doc.y);
      }

      doc
        .font('Helvetica')
        .fontSize(9)
        .text(`Status: ${invoice.status.replace(/_/g, ' ')}`, rightColX, y, { width: pageWidth * 0.4, align: 'right' });
      doc.text(`Issue date: ${new Date(invoice.issueDate).toLocaleDateString('en-SG')}`, rightColX, doc.y, {
        width: pageWidth * 0.4,
        align: 'right',
      });
      if (invoice.dueDate) {
        doc.text(`Due date: ${new Date(invoice.dueDate).toLocaleDateString('en-SG')}`, rightColX, doc.y, {
          width: pageWidth * 0.4,
          align: 'right',
        });
      }
      y = Math.max(doc.y, y) + 16;

      if (claim && claim.items.length > 0) {
        y = drawTable(
          doc,
          left,
          y,
          [
            { header: 'Description', width: pageWidth * 0.46 },
            { header: 'This Claim %', width: pageWidth * 0.18, align: 'right' },
            { header: 'Cumulative %', width: pageWidth * 0.18, align: 'right' },
            { header: 'Amount', width: pageWidth * 0.18, align: 'right' },
          ],
          claim.items,
          (item) => [
            item.description,
            `${Number(item.currentPercent).toFixed(1)}%`,
            `${Number(item.cumulativePercent).toFixed(1)}%`,
            formatMoney(item.amount, currency),
          ],
        );
        y += 10;
      } else {
        doc.fontSize(9).font('Helvetica').text(`Amount billed against ${invoice.project.name}.`, left, y);
        y = doc.y + 16;
      }

      const totalsX = left + pageWidth * 0.6;
      const totalsWidth = pageWidth * 0.4;
      const totalsRow = (label: string, value: string, bold = false): void => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
        doc.text(label, totalsX, y, { width: totalsWidth * 0.5, align: 'left' });
        doc.text(value, totalsX + totalsWidth * 0.5, y, { width: totalsWidth * 0.5, align: 'right' });
        y += 14;
      };
      totalsRow('Subtotal', formatMoney(invoice.subtotal, currency));
      totalsRow('Tax', formatMoney(invoice.taxAmount, currency));
      doc.moveTo(totalsX, y).lineTo(totalsX + totalsWidth, y).lineWidth(0.75).strokeColor('#1a1a1a').stroke();
      y += 6;
      totalsRow('Total', formatMoney(invoice.total, currency), true);
      totalsRow('Amount Paid', formatMoney(invoice.amountPaid, currency));
      totalsRow('Balance Due', formatMoney(balanceDue, currency), true);

      drawFooter(doc);
    });

    return { buffer, filename: `${invoice.invoiceNumber}.pdf` };
  }
}
