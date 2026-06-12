import { describe, expect, it } from "vitest";
import { rejectedBatchMessage } from "./syncEngine";

describe("rejectedBatchMessage", () => {
  it("returns null when a sync batch has no rejected sale", () => {
    expect(rejectedBatchMessage({ results: [{ id: "S1", status: "ok" }, { id: "S2", status: "duplicate" }] })).toBeNull();
  });

  it("summarizes rejected sale results for dead-letter handling", () => {
    expect(rejectedBatchMessage({ results: [{ id: "S1", status: "rejected", code: "INVALID_CASH" }] })).toBe("S1:INVALID_CASH");
  });
});
