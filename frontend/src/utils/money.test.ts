import { describe, expect, it } from "vitest";
import { bahtToSatang, formatMoney, formatQuantity, satangToBaht } from "./money";

describe("money utilities", () => {
  it("stores baht as integer satang", () => {
    expect(bahtToSatang("45.50")).toBe(4550);
    expect(bahtToSatang(0.1 + 0.2)).toBe(30);
    expect(satangToBaht(4550)).toBe(45.5);
  });

  it("formats money and base-unit quantities for display only", () => {
    expect(formatMoney(4550)).toBe("45.50");
    expect(formatQuantity(1500, 1000, "kg")).toBe("1.5 kg");
  });
});
