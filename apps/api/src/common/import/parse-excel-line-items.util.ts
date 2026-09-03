import { read as readWorkbook, utils as xlsxUtils } from 'xlsx';
import { COST_CATEGORIES, CostCategory } from '../constants/cost-category';

/**
 * Richer than project-import's ImportedLineItem (description/qty/unitPrice/
 * lineTotal only) — an Excel sheet gives us real columns, so category and
 * unit cost come through directly instead of being guessed at.
 */
export interface QuotationImportedItem {
  description: string;
  category: CostCategory;
  unit: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
}

/** Header cell text -> which field it feeds, matched case-insensitively as a substring so "Unit Price ($)" still matches "unit price". Checked in this order — longer/more specific keys first, so "unit cost" doesn't get swallowed by a bare "unit" column. */
const HEADER_MATCHERS: Array<{ field: keyof QuotationImportedItem; keywords: string[] }> = [
  { field: 'description', keywords: ['description', 'item', 'particular'] },
  { field: 'category', keywords: ['category', 'cost type'] },
  { field: 'unitCost', keywords: ['unit cost', 'cost price', 'cost/unit'] },
  { field: 'unitPrice', keywords: ['unit price', 'sell price', 'rate', 'price/unit'] },
  { field: 'quantity', keywords: ['quantity', 'qty'] },
  { field: 'unit', keywords: ['unit', 'uom'] },
];

function normalizeCategory(raw: string | undefined): CostCategory {
  const lower = raw?.trim().toLowerCase() ?? '';
  return (COST_CATEGORIES as readonly string[]).includes(lower) ? (lower as CostCategory) : 'material';
}

function toNumber(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  const parsed = parseFloat(String(raw ?? '').replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Scans the first N rows for a header row (must contain a "description"-ish
 * column — every other column is optional), then reads every row below it
 * as one line item until the sheet runs out. Deliberately tolerant of
 * missing optional columns — category/unit default, quantity/cost/price
 * default to 0 — so a rough copy-paste from a supplier's own quote still
 * imports something rather than being rejected outright.
 */
export function parseExcelLineItems(buffer: Buffer): QuotationImportedItem[] {
  const workbook = readWorkbook(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  const rows = xlsxUtils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });

  let headerRowIndex = -1;
  let columnMap: Partial<Record<keyof QuotationImportedItem, number>> = {};

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i].map((cell) => String(cell ?? '').trim().toLowerCase());
    const map: Partial<Record<keyof QuotationImportedItem, number>> = {};
    for (const { field, keywords } of HEADER_MATCHERS) {
      const colIndex = row.findIndex((cell) => keywords.some((kw) => cell.includes(kw)));
      if (colIndex >= 0 && map[field] === undefined) map[field] = colIndex;
    }
    if (map.description !== undefined) {
      headerRowIndex = i;
      columnMap = map;
      break;
    }
  }

  if (headerRowIndex === -1) return [];

  const items: QuotationImportedItem[] = [];
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const description = String(row[columnMap.description!] ?? '').trim();
    if (!description) continue;

    items.push({
      description,
      category: normalizeCategory(columnMap.category !== undefined ? String(row[columnMap.category] ?? '') : undefined),
      unit: columnMap.unit !== undefined ? String(row[columnMap.unit] ?? '').trim() || 'unit' : 'unit',
      quantity: columnMap.quantity !== undefined ? toNumber(row[columnMap.quantity]) : 0,
      unitCost: columnMap.unitCost !== undefined ? toNumber(row[columnMap.unitCost]) : 0,
      unitPrice: columnMap.unitPrice !== undefined ? toNumber(row[columnMap.unitPrice]) : 0,
    });
  }

  return items;
}
