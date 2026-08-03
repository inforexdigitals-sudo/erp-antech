import { priceLineItem, priceRevision } from './quotation-pricing.util';

describe('quotation-pricing.util', () => {
  describe('priceLineItem', () => {
    it('applies markup before discount, matching the wireframe builder', () => {
      // $100 unit price, qty 2, 10% markup -> $110/unit, then 5% discount off the line.
      const priced = priceLineItem({
        quantity: 2,
        unitPrice: 100,
        markupPercent: 10,
        discountPercent: 5,
        taxRatePercent: 0,
      });
      // 2 * 110 = 220; 220 * 0.95 = 209
      expect(priced.lineTotal).toBeCloseTo(209, 2);
    });

    it('computes line tax off the post-markup, post-discount amount', () => {
      const priced = priceLineItem({
        quantity: 1,
        unitPrice: 100,
        markupPercent: 0,
        discountPercent: 0,
        taxRatePercent: 9,
      });
      expect(priced.lineTax).toBeCloseTo(9, 2);
    });

    it('handles zero quantity/price gracefully', () => {
      const priced = priceLineItem({
        quantity: 1,
        unitPrice: 0,
        markupPercent: 0,
        discountPercent: 0,
        taxRatePercent: 9,
      });
      expect(priced.lineTotal).toBe(0);
      expect(priced.lineTax).toBe(0);
    });
  });

  describe('priceRevision', () => {
    it('matches the quotation builder wireframe totals for the chiller-plant example', () => {
      // docs/phase-4-ui-wireframes: 2x $68,000 equipment @ 12% markup = $152,320
      const totals = priceRevision([
        { quantity: 2, unitPrice: 68000, markupPercent: 12, discountPercent: 0, taxRatePercent: 0 },
      ]);
      expect(totals.subtotal).toBeCloseTo(152320, 2);
    });

    it('subtracts the overall discount from subtotal before computing total, and adds tax after', () => {
      const totals = priceRevision(
        [{ quantity: 1, unitPrice: 1000, markupPercent: 0, discountPercent: 0, taxRatePercent: 10 }],
        50,
      );
      // subtotal 1000, tax 100 (computed on the pre-overall-discount line — see docstring in quotation-pricing.util.ts),
      // total = 1000 - 50 + 100 = 1050
      expect(totals.subtotal).toBe(1000);
      expect(totals.taxAmount).toBe(100);
      expect(totals.discountAmount).toBe(50);
      expect(totals.total).toBe(1050);
    });

    it('sums per-line tax rather than applying one blended rate across mixed tax codes', () => {
      const totals = priceRevision([
        { quantity: 1, unitPrice: 100, markupPercent: 0, discountPercent: 0, taxRatePercent: 9 }, // $9 tax
        { quantity: 1, unitPrice: 100, markupPercent: 0, discountPercent: 0, taxRatePercent: 0 }, // $0 tax (no tax code)
      ]);
      expect(totals.taxAmount).toBe(9);
    });

    it('returns zeroed totals for an empty item list rather than throwing', () => {
      const totals = priceRevision([]);
      expect(totals).toMatchObject({ subtotal: 0, taxAmount: 0, total: 0 });
    });
  });
});
