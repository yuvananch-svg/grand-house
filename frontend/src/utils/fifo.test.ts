import { describe, expect, it } from "vitest";
import { consumeFifo, previewFifo, type FifoLot } from "./fifo";

function lots(): FifoLot[] {
  return [
    { lot_id: "RLOT-1", qty_remaining: 2, unit_cost: 100 },
    { lot_id: "RLOT-2", qty_remaining: 3, unit_cost: 120 }
  ];
}

describe("consumeFifo (D1 — Lot Overlapping)", () => {
  it("crosses two lots: 2@100 + 3@120 = 560, oldest lot drains to 0", () => {
    const ls = lots();
    const result = consumeFifo(ls, 5);
    expect(result.totalCost).toBe(560);
    expect(result.shortBy).toBe(0);
    expect(result.breakdown).toEqual([
      { lot_id: "RLOT-1", qty: 2, unit_cost: 100 },
      { lot_id: "RLOT-2", qty: 3, unit_cost: 120 }
    ]);
    expect(ls[0].qty_remaining).toBe(0);
    expect(ls[1].qty_remaining).toBe(0);
  });

  it("stays within the first lot when enough remains", () => {
    const ls = lots();
    const result = consumeFifo(ls, 1);
    expect(result.totalCost).toBe(100);
    expect(result.shortBy).toBe(0);
    expect(ls[0].qty_remaining).toBe(1);
    expect(ls[1].qty_remaining).toBe(3);
  });

  it("reports shortBy when stock is insufficient and takes what's available", () => {
    const ls = lots();
    const result = consumeFifo(ls, 8);
    expect(result.totalCost).toBe(560);
    expect(result.shortBy).toBe(3);
    expect(ls.every((lot) => lot.qty_remaining === 0)).toBe(true);
  });
});

describe("previewFifo (cost locking inputs — D3/D7)", () => {
  it("computes cost without mutating lots so historical cost stays stable", () => {
    const ls = lots();
    const preview = previewFifo(ls, 5);
    expect(preview.totalCost).toBe(560);
    expect(preview.shortBy).toBe(0);
    // a later batch at a higher price must not change earlier lots
    expect(ls[0].qty_remaining).toBe(2);
    expect(ls[1].qty_remaining).toBe(3);
  });
});
