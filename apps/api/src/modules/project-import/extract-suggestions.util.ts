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
  };
}
