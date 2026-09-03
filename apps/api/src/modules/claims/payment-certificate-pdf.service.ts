import { Injectable, NotFoundException } from '@nestjs/common';
import { CompanyRepository } from '../company/company.repository';
import { drawClosingBlock, drawDocumentTitle, drawFooter, drawLetterhead, generatePdfBuffer } from '../../common/pdf/letterhead';
import { drawTable, formatMoney } from '../../common/pdf/pdf-table';
import { ClaimsService } from './claims.service';

/**
 * Renders a certified Claim's Payment Certificate as a letterheaded PDF.
 * 404s if the claim hasn't been certified yet (no PaymentCertificate row —
 * see ClaimsService's private certify() for when that's created).
 */
@Injectable()
export class PaymentCertificatePdfService {
  constructor(
    private readonly claims: ClaimsService,
    private readonly companies: CompanyRepository,
  ) {}

  async generate(companyId: string, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const claim = await this.claims.findOne(companyId, id);
    if (!claim.paymentCertificate) {
      throw new NotFoundException('This claim has not been certified yet — no payment certificate exists.');
    }
    const company = await this.companies.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found.');
    }
    const currency = company.baseCurrency;
    const certificate = claim.paymentCertificate;
    const payee = claim.claimType === 'client' ? claim.customer?.name : claim.subcontractor?.name;

    const buffer = await generatePdfBuffer((doc) => {
      let y = drawLetterhead(doc, company);
      const left = doc.page.margins.left;
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      y = drawDocumentTitle(doc, y, 'PAYMENT CERTIFICATE', certificate.certificateNumber, certificate.issuedDate);

      doc.fontSize(10).font('Helvetica-Bold').text(claim.claimType === 'client' ? 'Client' : 'Subcontractor', left, y);
      y = doc.y + 2;
      doc.font('Helvetica').text(payee ?? '—', left, y);
      y = doc.y + 10;

      const rightColX = left + pageWidth * 0.6;
      doc.font('Helvetica-Bold').fontSize(9).text('Project', left, y);
      doc.font('Helvetica').text(`${claim.project.projectNumber} — ${claim.project.name}`, left, doc.y);
      doc.text(`Claim: ${claim.claimNumber}`, left, doc.y);

      doc
        .font('Helvetica')
        .fontSize(9)
        .text(
          `Claim period: ${new Date(claim.claimPeriodStart).toLocaleDateString('en-SG')} – ${new Date(
            claim.claimPeriodEnd,
          ).toLocaleDateString('en-SG')}`,
          rightColX,
          y,
          { width: pageWidth * 0.4, align: 'right' },
        );
      y = Math.max(doc.y, y) + 16;

      if (claim.items.length > 0) {
        y = drawTable(
          doc,
          left,
          y,
          [
            { header: 'Sl. No.', width: pageWidth * 0.06, align: 'center' },
            { header: 'Description', width: pageWidth * 0.28 },
            { header: 'Previous %', width: pageWidth * 0.16, align: 'right' },
            { header: 'This Claim %', width: pageWidth * 0.16, align: 'right' },
            { header: 'Cumulative %', width: pageWidth * 0.16, align: 'right' },
            { header: 'Amount', width: pageWidth * 0.18, align: 'right' },
          ],
          claim.items,
          (item, i) => [
            String(i + 1),
            item.description,
            `${Number(item.previousPercent).toFixed(1)}%`,
            `${Number(item.currentPercent).toFixed(1)}%`,
            `${Number(item.cumulativePercent).toFixed(1)}%`,
            formatMoney(item.amount, currency),
          ],
        );
        y += 10;
      }

      const totalsX = left + pageWidth * 0.6;
      const totalsWidth = pageWidth * 0.4;
      const totalsRow = (label: string, value: string, bold = false): void => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
        doc.text(label, totalsX, y, { width: totalsWidth * 0.5, align: 'left' });
        doc.text(value, totalsX + totalsWidth * 0.5, y, { width: totalsWidth * 0.5, align: 'right' });
        y += 14;
      };
      totalsRow('Claim Amount', formatMoney(claim.claimAmount, currency));
      totalsRow(`Retention (${Number(claim.retentionPercent)}%)`, `-${formatMoney(claim.retentionAmount, currency)}`);
      doc.moveTo(totalsX, y).lineTo(totalsX + totalsWidth, y).lineWidth(0.75).strokeColor('#1a1a1a').stroke();
      y += 6;
      totalsRow('Certified Amount', formatMoney(certificate.amount, currency), true);

      y = drawClosingBlock(doc, y + 20, company.name);
      drawFooter(doc);
    });

    return { buffer, filename: `${certificate.certificateNumber}.pdf` };
  }
}
