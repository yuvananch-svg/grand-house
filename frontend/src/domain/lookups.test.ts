import { describe, expect, it } from "vitest";
import { createSeedState } from "../data/seed";
import { auditFlagIncludes, bangkokDateFromIso, branchName, paymentLabel, productMatchesPosCategory, stockQty } from "./lookups";

describe("lookup helpers", () => {
  it("formats stable labels and branch names", () => {
    const state = createSeedState();
    expect(branchName(state, "BR-KASET")).toBe("เกษตรใหม่");
    expect(branchName(state, "ALL")).toBe("ทุกสาขา");
    expect(paymentLabel("THAI_HELP_THAI")).toBe("ไทยช่วยไทย");
  });

  it("matches POS categories with source-aware rice buttons", () => {
    const state = createSeedState();
    const parentRice = state.products.find((product) => product.id === "PRD-KAPRAO");
    const houseDrink = state.products.find((product) => product.id === "PRD-STRAWBERRY-MILK");
    expect(parentRice && productMatchesPosCategory(parentRice, "rice_parent")).toBe(true);
    expect(parentRice && productMatchesPosCategory(parentRice, "rice_house")).toBe(false);
    expect(houseDrink && productMatchesPosCategory(houseDrink, "drink")).toBe(true);
  });

  it("summarizes stock and audit/date helpers", () => {
    const state = createSeedState();
    expect(stockQty(state, "BR-KASET", "PRD-KAPRAO")).toBe(32);
    expect(auditFlagIncludes("PRICE_OVERRIDE,SUSPICIOUS", "SUSPICIOUS")).toBe(true);
    expect(bangkokDateFromIso("2026-06-11T18:30:00.000Z")).toBe("2026-06-12");
  });
});
