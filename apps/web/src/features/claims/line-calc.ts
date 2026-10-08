export interface ClaimCalcRow {
  contractQuantity?: number;
  unitPrice?: number;
  currentPercent: number;
  amount: number;
  /** Quantity done this period — a convenience input only, never sent to the API (the claim stores the % and the amount). */
  periodQty?: number;
  /** Which of qty / % the user last typed on this line — the other is derived from it, so a typed value is never overwritten by a value recomputed from a rounded one. Local only, never sent to the API. */
  periodDriver?: 'qty' | 'percent';
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

/**
 * Starting qty/driver for a line that already has a saved % and amount (the
 * Edit Claim popup). The claim only stores the % — rounded to 2 decimals —
 * so qty derived from it alone drifts (40 of 289 saves as 13.84%, which
 * gives 40.0016 back). When the saved amount agrees with the % within that
 * rounding, qty = amount / unit price recovers the exact figure typed.
 */
export function initialPeriodQty(row: Omit<ClaimCalcRow, 'periodQty' | 'periodDriver'>): Pick<ClaimCalcRow, 'periodQty' | 'periodDriver'> {
  const contractQty = row.contractQuantity;
  if (contractQty == null || contractQty <= 0) return {};
  const fromPercent = round4((contractQty * row.currentPercent) / 100);
  if (row.unitPrice != null && row.unitPrice > 0 && row.amount > 0) {
    const fromAmount = round4(row.amount / row.unitPrice);
    if (Math.abs(fromAmount - fromPercent) <= contractQty * 0.0001) {
      return { periodQty: fromAmount, periodDriver: 'qty' };
    }
  }
  return { periodQty: fromPercent, periodDriver: 'percent' };
}

/**
 * Keeps one claim line's This Period Qty, This Period % and Amount in step
 * after a single field was edited (LineItemsEditor changes one at a time).
 * Qty is the easier thing to type when a BOQ mixes metres, points and
 * units, so editing it derives the % (and the Amount straight from
 * qty × unit price, not via the 2-decimal-rounded %); editing the % derives
 * the qty. Changing the contract qty / unit price re-derives whichever of
 * the two was NOT typed last, so a typed qty stays exactly as typed.
 * Editing Amount directly is left alone — a manual override sticks.
 */
export function recalcClaimRow<T extends ClaimCalcRow>(prev: T | undefined, row: T): T {
  if (!prev) return row;
  if (row.amount !== prev.amount) return row;

  const contractQty = row.contractQuantity;
  const hasContractQty = contractQty != null && contractQty > 0;
  const priced = contractQty != null && row.unitPrice != null;

  if (row.periodQty !== prev.periodQty) {
    if (!hasContractQty) return { ...row, periodDriver: 'qty' };
    const periodQty = row.periodQty ?? 0;
    return {
      ...row,
      periodDriver: 'qty',
      currentPercent: round2((periodQty / contractQty) * 100),
      amount: row.unitPrice != null ? round2(periodQty * row.unitPrice) : row.amount,
    };
  }

  if (row.currentPercent !== prev.currentPercent) {
    return {
      ...row,
      periodDriver: 'percent',
      periodQty: hasContractQty ? round4((contractQty * row.currentPercent) / 100) : row.periodQty,
      amount: priced ? round2(contractQty * row.unitPrice! * (row.currentPercent / 100)) : row.amount,
    };
  }

  // Contract qty or unit price changed.
  if (row.periodDriver === 'qty' && hasContractQty) {
    const periodQty = row.periodQty ?? 0;
    return {
      ...row,
      currentPercent: round2((periodQty / contractQty) * 100),
      amount: row.unitPrice != null ? round2(periodQty * row.unitPrice) : row.amount,
    };
  }
  return {
    ...row,
    periodQty: hasContractQty ? round4((contractQty * row.currentPercent) / 100) : row.periodQty,
    amount: priced ? round2(contractQty * row.unitPrice! * (row.currentPercent / 100)) : row.amount,
  };
}
