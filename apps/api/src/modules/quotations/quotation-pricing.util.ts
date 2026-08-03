/**
 * Pure pricing math, kept separate from QuotationsService so it's
 * trivial to unit test without touching Prisma. Given the quotation
 * builder wireframe (docs/phase-4-ui-wireframes), markup and discount
 * are entered per line item, not as a single blended rate — so each
 * line's total already has markup/discount baked in by the time it
 * reaches the revision-level subtotal/tax/total roll-up.
 *
 * `QuotationRevision.markupPercent` (Phase 2 schema) is intentionally
 * NOT read here — it's a UI default for pre-filling new line items,
 * not a second markup applied on top of the per-item one. Applying
 * both would silently double-markup every line.
 */

export interface PricingLineItemInput {
  quantity: number;
  unitPrice: number;
  markupPercent: number;
  discountPercent: number;
  taxRatePercent: number; // 0 if the line has no tax code
}

export interface PricedLineItem extends PricingLineItemInput {
  lineTotal: number; // pre-tax
  lineTax: number;
}

export interface RevisionTotals {
  items: PricedLineItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
}

export function priceLineItem(input: PricingLineItemInput): PricedLineItem {
  const markedUpUnitPrice = input.unitPrice * (1 + input.markupPercent / 100);
  const lineTotal = round2(input.quantity * markedUpUnitPrice * (1 - input.discountPercent / 100));
  const lineTax = round2(lineTotal * (input.taxRatePercent / 100));
  return { ...input, lineTotal, lineTax };
}

/**
 * @param overallDiscountAmount a flat amount taken off the subtotal
 *   before tax (e.g. a negotiated lump-sum discount) — distinct from
 *   each line's own discountPercent.
 */
export function priceRevision(
  lineInputs: PricingLineItemInput[],
  overallDiscountAmount = 0,
): RevisionTotals {
  const items = lineInputs.map(priceLineItem);
  const subtotal = round2(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const taxAmount = round2(items.reduce((sum, item) => sum + item.lineTax, 0));
  const total = round2(subtotal - overallDiscountAmount + taxAmount);

  return { items, subtotal, discountAmount: round2(overallDiscountAmount), taxAmount, total };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
