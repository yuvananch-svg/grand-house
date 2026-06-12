import { describe, expect, it } from "vitest";
import type { AuditLog } from "../types";
import { csvCell, safeParse, verifyChain } from "./audit";

function auditRow(id: string, prev_hash: string, row_hash: string): AuditLog {
  return {
    id,
    timestamp: "2026-06-12T00:00:00.000Z",
    user_id: "owner",
    role: "owner",
    branch_id: "ALL",
    action: "TEST",
    feature_group: "report",
    ref_id: id,
    detail: "{}",
    flag: "",
    device_id: "DEV-TEST",
    success: true,
    prev_hash,
    row_hash
  };
}

describe("audit domain", () => {
  it("verifies continuity within the loaded audit slice", () => {
    expect(verifyChain([
      auditRow("A1", "OLDER_HASH", "H1"),
      auditRow("A2", "H1", "H2")
    ])).toEqual({ ok: true });

    expect(verifyChain([
      auditRow("A1", "OLDER_HASH", "H1"),
      auditRow("A2", "BROKEN", "H2")
    ])).toEqual({ ok: false, brokenAt: "A2" });
  });

  it("sanitizes CSV cells that Excel may execute as formulas", () => {
    expect(csvCell("=IMPORTXML(\"x\")")).toBe("\"'=IMPORTXML(\"\"x\"\")\"");
    expect(csvCell("plain")).toBe("\"plain\"");
  });

  it("parses JSON details and leaves invalid JSON unchanged", () => {
    expect(safeParse("{\"ok\":true}")).toEqual({ ok: true });
    expect(safeParse("not-json")).toBe("not-json");
  });
});
