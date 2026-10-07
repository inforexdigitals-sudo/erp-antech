export interface ClaimCalcRow {
  contractQuantity?: number;
  unitPrice?: number;
  currentPercent: number;
  amount: number;
  /** Quantity done this period — a convenience input only, never sent to the API (the claim stores the % and the amount). */
  periodQty?: number;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

/**
 * Keeps one claim line's This Period Qty, This Period % and Amount in step
 * after a single field was edited (LineItemsEditor changes one at a time).
 * Qty is the easier thing to type when a BOQ mixes metres, points and
 * units, so editing it derives the % (and the Amount straight from
 * qty × unit price, not via the 2-decimal-rounded %); editing the % derives
 * the qty; changing the contract qty / unit price keeps the % and re-derives
 * the rest. Editing Amount directly is left alone — a manual override sticks.
 */
export function recalcClaimRow<T extends ClaimCalcRow>(prev: T | undefined, row: T): T {
  if (!prev) return row;
  if (row.amount !== prev.amount) return row;

  const contractQty = row.contractQuantity;
  const hasContractQty = contractQty != null && contractQty > 0;
  const priced = contractQty != null && row.unitPrice != null;

  if (row.periodQty !== prev.periodQty) {
    if (!hasContractQty) return row;
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
