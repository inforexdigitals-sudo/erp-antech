import { Company } from '@prisma/client';
import PDFDocument from 'pdfkit';

/** Matches apps/web/src/components/CompanyHeader.tsx's palette exactly — same letterhead in-app and on paper. */
const NAVY = '#0B2E5B';
const SECONDARY_BLUE = '#244E86';
const LIGHT_GREY = '#D9D9D9';
const DARK_TEXT = '#222222';
const LINK_BLUE = '#1A56DB';

/**
 * A banner-shaped upload (wide letterhead artwork — logo mark + company
 * details + divider already composed into one image, e.g. exported from
 * Word/Canva) is meant to replace the whole header, not sit in a small
 * logo box. A squarish/tall upload is treated as just a logo mark instead.
 * 2.5 : 1 comfortably separates "AE" square icons from wide bands without
 * needing a second, separate upload field for tenants who already have
 * finished letterhead artwork.
 */
const BANNER_ASPECT_RATIO_THRESHOLD = 2.5;

/** doc.image()'s underlying image opener, used here just to read natural pixel dimensions ahead of drawing — real at runtime (verified against pdfkit 0.19) but not part of @types/pdfkit's declarations. */
interface ImageOpener {
  openImage(src: Buffer): { width: number; height: number };
}

/**
 * Shared by every generated document (Quotation, Purchase Order, Invoice,
 * Payment Certificate) — see apps/api/README.md's PDF export section.
 *
 * Two modes, chosen by the uploaded logo's aspect ratio:
 *  - Banner: the image IS the header — drawn full page width, verbatim,
 *    nothing else composed on top of or below it. For a tenant that
 *    already has finished letterhead artwork ("paste my header, don't
 *    recreate it"), this is pixel-for-pixel what they uploaded.
 *  - Logo mark: mirrors apps/web/src/components/CompanyHeader.tsx's
 *    layout — logo in a left column (~25% width, fixed max height, never
 *    stretched), description lines + Web Page/Email/HP on the right
 *    (~75%), a navy/secondary-blue/grey divider underneath. The contact
 *    lines are real clickable link annotations, not just blue text.
 *
 * If no logo has been uploaded yet (company/logo.ts — stored as bytes on
 * the company row, not a stub), the company name stands in for it in logo
 * mark mode. SVG isn't rasterized here — pdfkit's `.image()` only accepts
 * PNG/JPEG — so an SVG upload also falls back to the name.
 *
 * Returns the Y coordinate where the document's own content should start.
 */
export function drawLetterhead(doc: PDFKit.PDFDocument, company: Company): number {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startX = doc.page.margins.left;
  const topY = doc.page.margins.top;

  const hasRasterLogo = company.logoData && company.logoMimeType && company.logoMimeType !== 'image/svg+xml';
  const logoBuffer = hasRasterLogo ? Buffer.from(company.logoData as Buffer) : null;
  const logoDimensions = logoBuffer ? (doc as unknown as ImageOpener).openImage(logoBuffer) : null;
  const isBanner = logoDimensions ? logoDimensions.width / logoDimensions.height >= BANNER_ASPECT_RATIO_THRESHOLD : false;

  if (logoBuffer && isBanner) {
    const MAX_BANNER_HEIGHT = 120;
    doc.image(logoBuffer, startX, topY, { fit: [pageWidth, MAX_BANNER_HEIGHT] });
    const bannerHeight = Math.min(MAX_BANNER_HEIGHT, (pageWidth * logoDimensions!.height) / logoDimensions!.width);
    doc.fillColor('#000000');
    return topY + bannerHeight + 16;
  }

  const MAX_LOGO_HEIGHT = 62;
  const leftWidth = pageWidth * 0.25;
  const rightX = startX + leftWidth + 14;
  const rightWidth = pageWidth - leftWidth - 14;

  // Left column — logo (or the company name, if none has been uploaded yet).
  if (logoBuffer) {
    doc.image(logoBuffer, startX, topY, { fit: [leftWidth, MAX_LOGO_HEIGHT] });
  } else {
    doc
      .fontSize(15)
      .font('Helvetica-Bold')
      .fillColor(NAVY)
      .text(company.name, startX, topY, { width: leftWidth });
  }

  // Right column — description lines, then Web Page/Email, then HP, as real clickable links.
  let y = topY;
  const lineGap = 3;
  const setLineFont = (): void => {
    doc.fontSize(9.5).font('Helvetica').fillColor(DARK_TEXT);
  };

  if (company.description1) {
    setLineFont();
    doc.text(company.description1, rightX, y, { width: rightWidth });
    y = doc.y + lineGap;
  }
  if (company.description2) {
    setLineFont();
    doc.text(company.description2, rightX, y, { width: rightWidth });
    y = doc.y + lineGap;
  }

  if (company.website || company.email) {
    setLineFont();
    let x = rightX;
    if (company.website) {
      const label = 'Web Page: ';
      doc.fillColor(DARK_TEXT).text(label, x, y, { continued: true, lineBreak: false });
      x += doc.widthOfString(label);
      const websiteHref = /^https?:\/\//i.test(company.website) ? company.website : `https://${company.website}`;
      const websiteWidth = doc.widthOfString(company.website);
      doc.fillColor(LINK_BLUE).text(company.website, x, y, { continued: !!company.email, lineBreak: false });
      doc.link(x, y, websiteWidth, 12, websiteHref);
      x += websiteWidth;
    }
    if (company.email) {
      const sep = company.website ? '   Email: ' : 'Email: ';
      doc.fillColor(DARK_TEXT).text(sep, x, y, { continued: true, lineBreak: false });
      x += doc.widthOfString(sep);
      const emailWidth = doc.widthOfString(company.email);
      doc.fillColor(LINK_BLUE).text(company.email, x, y, { continued: false, lineBreak: false });
      doc.link(x, y, emailWidth, 12, `mailto:${company.email}`);
    }
    y += 12 + lineGap;
  }

  if (company.phone) {
    setLineFont();
    const label = 'HP: ';
    doc.fillColor(DARK_TEXT).text(label, rightX, y, { continued: true, lineBreak: false });
    const labelWidth = doc.widthOfString(label);
    const phoneWidth = doc.widthOfString(company.phone);
    doc.fillColor(LINK_BLUE).text(company.phone, rightX + labelWidth, y, { continued: false, lineBreak: false });
    doc.link(rightX + labelWidth, y, phoneWidth, 12, `tel:${company.phone.replace(/[^\d+]/g, '')}`);
    y += 12 + lineGap;
  }

  let cursorY = Math.max(topY + MAX_LOGO_HEIGHT, y) + 10;

  // Divider — navy / secondary-blue / light-grey segments, same proportions as CompanyHeader.tsx.
  const dividerHeight = 3;
  const navyWidth = pageWidth * 0.6;
  const secondaryWidth = pageWidth * 0.3;
  const greyWidth = pageWidth - navyWidth - secondaryWidth;
  doc.rect(startX, cursorY, navyWidth, dividerHeight).fill(NAVY);
  doc.rect(startX + navyWidth, cursorY, secondaryWidth, dividerHeight).fill(SECONDARY_BLUE);
  doc.rect(startX + navyWidth + secondaryWidth, cursorY, greyWidth, dividerHeight).fill(LIGHT_GREY);
  cursorY += dividerHeight + 16;

  doc.fillColor('#000000');
  return cursorY;
}

/**
 * The big document-type title (QUOTATION / PURCHASE ORDER / TAX INVOICE /
 * PAYMENT CERTIFICATE), centered on the page, with the document number and
 * its date stacked in the top-right corner — same layout on every
 * generated document. Returns the Y coordinate where the next content
 * (Bill To / Supplier / etc.) should start.
 */
export function drawDocumentTitle(doc: PDFKit.PDFDocument, y: number, title: string, documentNumber: string, date: Date): number {
  const left = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000').text(title, left, y, { width: pageWidth, align: 'center' });
  const titleBottomY = doc.y;

  doc.fontSize(10).font('Helvetica').text(documentNumber, left, y, { width: pageWidth, align: 'right' });
  doc.text(date.toLocaleDateString('en-SG'), left, doc.y, { width: pageWidth, align: 'right' });

  return Math.max(titleBottomY, doc.y) + 16;
}

/**
 * Closing line + "Yours Faithfully" / "Confirmed and Accepted By" signature
 * boxes. Drawn once as the final piece of document content (unlike
 * drawFooter's Page X of Y, which repeats on every page) — call it last,
 * right before drawFooter(), so it lands wherever the content naturally
 * ends, i.e. the last page.
 */
export function drawClosingBlock(doc: PDFKit.PDFDocument, y: number, companyName: string): number {
  const left = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor('#000000')
    .text('We trust the above meet your requirement and look forward to hear from you soon. Thank you.', left, y, {
      width: pageWidth,
    });
  y = doc.y + 20;

  const boxWidth = pageWidth * 0.42;
  const boxHeight = 90;
  const rightBoxX = left + pageWidth - boxWidth;

  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .text('Confirmed and Accepted By,', rightBoxX, y, { width: boxWidth, align: 'center' });
  const boxTopY = doc.y + 6;

  doc.lineWidth(1).strokeColor('#000000');
  doc.rect(left, boxTopY, boxWidth, boxHeight).stroke();
  doc.rect(rightBoxX, boxTopY, boxWidth, boxHeight).stroke();

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000').text('Yours Faithfully', left + 8, boxTopY + 8);
  doc.text(companyName, left + 8, boxTopY + boxHeight - 20, { width: boxWidth - 16 });

  return boxTopY + boxHeight + 16;
}

/** Stamps "Page X of Y" on every buffered page. Call once, right before `doc.end()`. */
export function drawFooter(doc: PDFKit.PDFDocument): void {
  const range = doc.bufferedPageRange();

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Must stay <= page.height - margins.bottom — pdfkit's text() triggers an
    // automatic page break past that line regardless of an explicit y
    // coordinate, which previously spawned extra blank pages here.
    const bottom = doc.page.height - doc.page.margins.bottom - 16;
    doc
      .fontSize(7)
      .font('Helvetica')
      .fillColor('#999999')
      .text(`Page ${i - range.start + 1} of ${range.count}`, doc.page.margins.left, bottom, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: 'right',
        lineBreak: false,
      });
  }
}

export function createPdfDocument(): PDFKit.PDFDocument {
  return new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
}

/** Collects a pdfkit document's output stream into a single Buffer. */
export function generatePdfBuffer(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  const doc = createPdfDocument();
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  build(doc);
  doc.end();
  return done;
}
