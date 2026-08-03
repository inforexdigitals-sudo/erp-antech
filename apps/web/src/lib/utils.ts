import clsx, { type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/**
 * Every Prisma `Decimal` field (money, quantities, hours, percentages)
 * serializes over the wire as a JSON *string* — confirmed against the
 * real running API, not assumed (`"subtotal":"6500"`, not `6500`).
 * There is no global interceptor coercing these to numbers. Every
 * `api.ts` in this codebase types these fields as `string`, and any
 * code doing arithmetic or formatting on one must go through this
 * first — `"500" + "500"` silently concatenates to `"500500"` instead
 * of adding, which is the exact class of bug this exists to prevent.
 */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value);
}

export function formatCurrency(value: string | number | null | undefined, currency = 'SGD'): string {
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    toNumber(value),
  );
}

export function formatNumber(value: string | number | null | undefined, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat('en-SG', { maximumFractionDigits }).format(toNumber(value));
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-SG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** For `<input type="date">` values (YYYY-MM-DD) from an ISO datetime or date-only string. */
export function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

export function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
