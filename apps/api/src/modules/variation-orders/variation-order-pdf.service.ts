import { Injectable, NotFoundException } from '@nestjs/common';
import { CompanyRepository } from '../company/company.repository';
import {
  CLOSING_BLOCK_HEIGHT,
  drawClosingBlock,
  drawDocumentTitle,
  drawFooter,
  drawLetterhead,
  ensureSpace,
  generatePdfBuffer,
} from '../../common/pdf/letterhead';
import { drawTable, formatMoney } from '../../common/pdf/pdf-table';
import { VariationOrdersService } from './variation-orders.service';

/** Renders a Variation Order as a letterheaded PDF — same pattern as PurchaseOrderPdfService. */
@Injectable()
export class VariationOrderPdfService {
  constructor(
    private readonly variationOrders: VariationOrdersService,
    private readonly companies: CompanyRepository,
  ) {}

  async generate(companyId: string, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const vo = await this.variationOrders.findOne(companyId, id);
    const company = await this.companies.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found.');
    }
    const currency = company.baseCurrency;

    const buffer = await generatePdfBuffer((doc) => {
      let y = drawLetterhead(doc, company);
      const left = doc.page.margins.left;
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      y = drawDocumentTitle(doc, y, 'VARIATION ORDER', vo.voNumber, vo.createdAt);

      const rightColX = left + pageWidth * 0.6;
      const leftColWidth = pageWidth * 0.56;

      doc.fontSize(10).font('Helvetica-Bold').text('Title', left, y);
      y = doc.y + 2;
      doc.font('Helvetica').text(vo.title, left, y, { width: leftColWidth });
      y = doc.y + 10;

      doc.font('Helvetica-Bold').fontSize(9).text('Project', left, y);
      doc.font('Helvetica').text(`${vo.project.projectNumber} — ${vo.project.name}`, left, doc.y, { width: leftColWidth });
      doc.text(`Cause: ${vo.cause.replace(/_/g, ' ')}`, left, doc.y, { width: leftColWidth });
      doc.text(`Requested by: ${vo.requester.fullName}`, left, doc.y, { width: leftColWidth });
      const leftColBottomY = doc.y;

      doc.font('Helvetica').fontSize(9).text(`Status: ${vo.status.replace(/_/g, ' ')}`, rightColX, y, { width: pageWidth * 0.4, align: 'right' });
      if (vo.approver) {
        doc.text(`Approved by: ${vo.approver.fullName}`, rightColX, doc.y, { width: pageWidth * 0.4, align: 'right' });
      }
      if (vo.approvedAt) {
        doc.text(`Approved: ${new Date(vo.approvedAt).toLocaleDateString('en-SG')}`, rightColX, doc.y, { width: pageWidth * 0.4, align: 'right' });
      }
      if (vo.scheduleImpactDays !== 0) {
        doc.text(`Schedule impact: ${vo.scheduleImpactDays > 0 ? '+' : ''}${vo.scheduleImpactDays} day(s)`, rightColX, doc.y, {
          width: pageWidth * 0.4,
          align: 'right',
        });
      }
      y = Math.max(doc.y, leftColBottomY) + 16;

      if (vo.items.length > 0) {
        y = drawTable(
          doc,
          left,
          y,
          [
            { header: 'Sl. No.', width: pageWidth * 0.06, align: 'center' },
            { header: 'Description', width: pageWidth * 0.32 },
            { header: 'Category', width: pageWidth * 0.15 },
            { header: 'Qty', width: pageWidth * 0.14, align: 'right' },
            { header: 'Unit Price', width: pageWidth * 0.16, align: 'right' },
            { header: 'Line Total', width: pageWidth * 0.17, align: 'right' },
          ],
          vo.items,
          (item, i) => {
            const quantity = Number(item.quantity ?? 0);
            const unitPrice = Number(item.unitPrice ?? 0);
            return [
              String(i + 1),
              item.description,
              item.costCategory,
              item.quantity != null ? `${quantity} ${item.unit ?? ''}`.trim() : '—',
              item.unitPrice != null ? formatMoney(unitPrice, currency) : '—',
              item.quantity != null && item.unitPrice != null ? formatMoney(quantity * unitPrice, currency) : '—',
            ];
          },
        );
        y += 10;
      }

      y = ensureSpace(doc, y, 50) + 10;
      const totalsX = left + pageWidth * 0.6;
      const totalsWidth = pageWidth * 0.4;
      const totalsRow = (label: string, value: string, bold = false): void => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
        doc.text(label, totalsX, y, { width: totalsWidth * 0.5, align: 'left' });
        doc.text(value, totalsX + totalsWidth * 0.5, y, { width: totalsWidth * 0.5, align: 'right' });
        y += 14;
      };
      totalsRow('Cost Impact', formatMoney(vo.costImpact, currency), true);
      totalsRow('Revenue Impact', formatMoney(vo.revenueImpact, currency), true);

      y = ensureSpace(doc, y, 14 + CLOSING_BLOCK_HEIGHT);
      y = drawClosingBlock(doc, y + 14, company.name);
      drawFooter(doc);
    });

    return { buffer, filename: `${vo.voNumber}.pdf` };
  }
}
