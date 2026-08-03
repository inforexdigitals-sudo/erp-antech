/** Formats a Prisma Decimal (or plain number/string) the same way the frontend does — see apps/web/src/lib/utils.ts's toNumber(). */
export function formatMoney(value: unknown, currency = 'SGD'): string {
  const num = typeof value === 'number' ? value : Number(value ?? 0);
  return `${currency} ${num.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface PdfTableColumn {
  header: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

/**
 * A minimal, hand-rolled table renderer — pdfkit has no built-in table
 * primitive. Draws a header row (bold, ruled underneath) then one row per
 * item via `getRow`, wrapping to a new page (re-drawing the header) when a
 * row would overflow the bottom margin.
 */
export function drawTable<T>(
  doc: PDFKit.PDFDocument,
  startX: number,
  startY: number,
  columns: PdfTableColumn[],
  rows: T[],
  getRow: (row: T) => string[],
): number {
  const rowHeight = 20;
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  let y = startY;

  const drawHeader = (headerY: number): number => {
    let x = startX;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#1a1a1a');
    for (const col of columns) {
      doc.text(col.header, x, headerY, { width: col.width, align: col.align ?? 'left' });
      x += col.width;
    }
    const ruleY = headerY + 14;
    doc
      .moveTo(startX, ruleY)
      .lineTo(x, ruleY)
      .lineWidth(0.75)
      .strokeColor('#cccccc')
      .stroke();
    return ruleY + 6;
  };

  y = drawHeader(y);

  doc.font('Helvetica').fontSize(8).fillColor('#000000');
  for (const row of rows) {
    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      y = doc.page.margins.top;
      y = drawHeader(y);
      doc.font('Helvetica').fontSize(8).fillColor('#000000');
    }
    let x = startX;
    const cells = getRow(row);
    for (let i = 0; i < columns.length; i++) {
      doc.text(cells[i] ?? '', x, y, { width: columns[i].width, align: columns[i].align ?? 'left' });
      x += columns[i].width;
    }
    y += rowHeight;
  }

  return y;
}
