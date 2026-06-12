import type { LotBreakdown } from "../types";

export interface FifoLot {
  lot_id: string;
  qty_remaining: number;
  unit_cost: number;
}

export interface FifoResult {
  breakdown: LotBreakdown[];
  totalCost: number;
  shortBy: number;
}

/**
 * Consume `qtyNeeded` units across FIFO-ordered lots, crossing lot boundaries (Lot Overlapping).
 * Mutates each consumed lot's `qty_remaining` in place. Pass lots already sorted oldest-first.
 * Returns the per-lot breakdown, the weighted total cost, and how much could not be filled.
 */
export function consumeFifo<T extends FifoLot>(sortedLots: T[], qtyNeeded: number): FifoResult {
  let remaining = qtyNeeded;
  let totalCost = 0;
  const breakdown: LotBreakdown[] = [];
  for (const lot of sortedLots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.qty_remaining, remaining);
    if (take <= 0) continue;
    lot.qty_remaining -= take;
    remaining -= take;
    totalCost += take * lot.unit_cost;
    breakdown.push({ lot_id: lot.lot_id, qty: take, unit_cost: lot.unit_cost });
  }
  return { breakdown, totalCost, shortBy: remaining };
}

/** Non-mutating cost preview over FIFO-ordered lots. */
export function previewFifo(sortedLots: FifoLot[], qtyNeeded: number): { totalCost: number; shortBy: number } {
  let remaining = qtyNeeded;
  let totalCost = 0;
  for (const lot of sortedLots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.qty_remaining, remaining);
    if (take <= 0) continue;
    remaining -= take;
    totalCost += take * lot.unit_cost;
  }
  return { totalCost, shortBy: remaining };
}
