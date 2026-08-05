/**
 * Best-effort field guesses from an old PDF's extracted text — never
 * trusted directly. project-import.controller.ts's /confirm endpoint
 * always requires the (possibly user-corrected) final values; nothing
 * here writes to the database on its own. See project-import.service.ts.
 */
export interface ImportSuggestions {
  suggestedName: string;
  suggestedContractValue: number | null;
  suggestedStartDate: string | null;
  suggestedCustomerId: string | null;
  suggestedCustomerName: string | null;
  /** True when extracted text is too short to guess anything from — usually means the PDF is a scanned/photographed image, which this app can't OCR yet. */
  looksScanned: boolean;
  /** Best-effort line-item guesses (description + qty/unit price/amount) from a table-like layout in the PDF text. Same "never trusted directly" rule as everything else here — always shown as an editable table, never saved as-is. */
  suggestedItems: ImportedLineItem[];
}

export interface ImportedLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

const MIN_TEXT_LENGTH_FOR_CONFIDENCE = 40;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Turns "old-quote-2019_marina-bay.pdf" into "old quote 2019 marina bay" — a predictable, always-available starting point for the project name, rather than guessing at a "title" from arbitrary body text. */
function nameFromFilename(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^.]+$/, '');
  const spaced = withoutExt.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

function findContractValue(text: string): number | null {
  const matches = Array.from(text.matchAll(/(?:SGD|USD|MYR|\$)\s?([\d,]+\.\d{2})/gi)).map((m) =>
    parseFloat(m[1].replace(/,/g, '')),
  );
  if (matches.length === 0) return null;
  return Math.max(...matches);
}

function findStartDate(text: string): string | null {
  const slash = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (slash) {
    const [, d, m, y] = slash;
    const day = Number(d);
    const month = Number(m);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  const named = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})\b/);
  if (named) {
    const [, d, monthName, y] = named;
    const monthIndex = MONTHS.indexOf(monthName.slice(0, 3).toLowerCase());
    if (monthIndex >= 0) {
      return `${y}-${String(monthIndex + 1).padStart(2, '0')}-${String(Number(d)).padStart(2, '0')}`;
    }
  }
  return null;
}

const NUMBER_TOKEN = /-?\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?/g;
/** Rows that are a document total/tax summary, not a purchasable line item — these commonly end in a number too, so they'd otherwise get mistaken for one. */
const SUMMARY_ROW = /\b(sub\s?total|grand\s?total|total|gst|vat|tax)\b/i;
const MIN_DESCRIPTION_LENGTH = 3;

/**
 * Heuristic table-row parser: takes the trailing 1-3 numeric tokens on a line
 * as amount/rate/qty and whatever text precedes them as the description.
 * Old quotations exported to PDF vary a lot in column layout, so this is
 * deliberately loose — it's a starting point for the review table, not a
 * source of truth (see ImportSuggestions.suggestedItems doc comment).
 */
function findLineItems(text: string): ImportedLineItem[] {
  const items: ImportedLineItem[] = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || SUMMARY_ROW.test(line) || /^page\s+\d+/i.test(line)) continue;

    const matches = Array.from(line.matchAll(NUMBER_TOKEN));
    if (matches.length === 0) continue;

    const description = line.slice(0, matches[0].index).trim();
    if (description.length < MIN_DESCRIPTION_LENGTH || /^\d+$/.test(description)) continue;

    const numbers = matches.map((m) => parseFloat(m[0].replace(/[$,]/g, '')));
    const trailing = numbers.slice(-3);

    let quantity: number;
    let unitPrice: number;
    let lineTotal: number;
    if (trailing.length >= 3) {
      [quantity, unitPrice, lineTotal] = trailing.slice(-3);
    } else if (trailing.length === 2) {
      [quantity, lineTotal] = trailing;
      unitPrice = quantity !== 0 ? lineTotal / quantity : lineTotal;
    } else {
      quantity = 1;
      unitPrice = trailing[0];
      lineTotal = trailing[0];
    }
    if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice) || !Number.isFinite(lineTotal)) continue;

    items.push({ description, quantity, unitPrice, lineTotal });
  }

  return items;
}

function findCustomer(text: string, customers: { id: string; name: string }[]): { id: string; name: string } | null {
  const lowerText = text.toLowerCase();
  for (const c of customers) {
    if (c.name.length >= 3 && lowerText.includes(c.name.toLowerCase())) {
      return c;
    }
  }
  return null;
}

export function extractSuggestions(
  fileName: string,
  text: string,
  customers: { id: string; name: string }[],
): ImportSuggestions {
  const suggestedName = nameFromFilename(fileName);
  const looksScanned = text.trim().length < MIN_TEXT_LENGTH_FOR_CONFIDENCE;

  if (looksScanned) {
    return {
      suggestedName,
      suggestedContractValue: null,
      suggestedStartDate: null,
      suggestedCustomerId: null,
      suggestedCustomerName: null,
      looksScanned: true,
      suggestedItems: [],
    };
  }

  const customerMatch = findCustomer(text, customers);

  return {
    suggestedName,
    suggestedContractValue: findContractValue(text),
    suggestedStartDate: findStartDate(text),
    suggestedCustomerId: customerMatch?.id ?? null,
    suggestedCustomerName: customerMatch?.name ?? null,
    looksScanned: false,
    suggestedItems: findLineItems(text),
  };
}
