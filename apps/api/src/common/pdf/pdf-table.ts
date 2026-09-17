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

/** Matches letterhead.ts's NAVY — same brand color on the header band as the rest of the document. */
const HEADER_BG = '#0B2E5B';
const HEADER_TEXT = '#ffffff';
const STRIPE_BG = '#F2F5F9';
/** Deliberately darker than STRIPE_BG so the line under each row stays visible even on shaded rows — a lighter gray nearly disappeared against the stripe. */
const BORDER_COLOR = '#9AA5B3';

/** Horizontal gap kept inside every cell so adjacent columns never visually touch, even when a cell's text runs the full width of its column. */
const CELL_PADDING_X = 6;
const CELL_PADDING_Y = 6;
const MIN_ROW_HEIGHT = 20;
const HEADER_HEIGHT = 22;

/**
 * A minimal, hand-rolled table renderer — pdfkit has no built-in table
 * primitive. Draws a filled/bordered header row then one bordered, zebra-
 * striped row per item via `getRow`, wrapping to a new page (re-drawing the
 * header) when a row would overflow the bottom margin. Row height grows to
 * fit whichever cell wraps to the most lines, so long descriptions never
 * overlap the row below.
 */
export function drawTable<T>(
  doc: PDFKit.PDFDocument,
  startX: number,
  startY: number,
  columns: PdfTableColumn[],
  rows: T[],
  getRow: (row: T, index: number) => string[],
): number {
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  let y = startY;

  const drawHeader = (headerY: number): number => {
    doc.rect(startX, headerY, tableWidth, HEADER_HEIGHT).fill(HEADER_BG);
    let x = startX;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(HEADER_TEXT);
    for (const col of columns) {
      doc.text(col.header, x + CELL_PADDING_X, headerY + 7, {
        width: col.width - CELL_PADDING_X * 2,
        align: col.align ?? 'left',
      });
      x += col.width;
    }
    doc.lineWidth(0.75).strokeColor(HEADER_BG).rect(startX, headerY, tableWidth, HEADER_HEIGHT).stroke();
    return headerY + HEADER_HEIGHT;
  };

  const drawRowBorders = (rowY: number, rowHeight: number): void => {
    doc.lineWidth(0.75).strokeColor(BORDER_COLOR);
    let x = startX;
    for (const col of columns) {
      doc.moveTo(x, rowY).lineTo(x, rowY + rowHeight).stroke();
      x += col.width;
    }
    doc.moveTo(x, rowY).lineTo(x, rowY + rowHeight).stroke();
    doc.moveTo(startX, rowY + rowHeight).lineTo(x, rowY + rowHeight).stroke();
  };

  y = drawHeader(y);

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const cells = getRow(row, rowIndex);
    doc.font('Helvetica').fontSize(8);
    const rowHeight = Math.max(
      MIN_ROW_HEIGHT,
      ...columns.map(
        (col, i) => doc.heightOfString(cells[i] ?? '', { width: col.width - CELL_PADDING_X * 2 }) + CELL_PADDING_Y * 2,
      ),
    );

    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      y = doc.page.margins.top;
      y = drawHeader(y);
    }

    if (rowIndex % 2 === 1) {
      doc.rect(startX, y, tableWidth, rowHeight).fill(STRIPE_BG);
    }

    let x = startX;
    doc.font('Helvetica').fontSize(8).fillColor('#000000');
    for (let i = 0; i < columns.length; i++) {
      doc.text(cells[i] ?? '', x + CELL_PADDING_X, y + CELL_PADDING_Y, {
        width: columns[i].width - CELL_PADDING_X * 2,
        align: columns[i].align ?? 'left',
      });
      x += columns[i].width;
    }

    drawRowBorders(y, rowHeight);
    y += rowHeight;
  }

  return y;
}
