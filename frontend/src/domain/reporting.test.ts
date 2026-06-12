import { describe, expect, it } from "vitest";
import { createSeedState } from "../data/seed";
import { countSales, countWastage, summarize } from "./reporting";

describe("reporting domain", () => {
  it("summarizes revenue from DailySummary when available", () => {
    const state = createSeedState();
    const row = {
      id: "DSM-BR-KASET-2026-06-12",
      branch_id: "BR-KASET" as const,
      business_date: "2026-06-12",
      rev_normal: 12000,
      rev_discount: 3000,
      rev_freebie: 2000,
      rev_staff: 1000,
      pay_qr1: 12000,
      pay_qr2: 0,
      pay_grab: 0,
      pay_cash: 6000,
      pay_thai: 0,
      pay_other: 0,
      cogs_total: 7000,
      wastage_value: 900,
      bill_count: 4,
      void_count: 1,
      last_rebuilt_at: "2026-06-12T00:00:00.000Z"
    };
    state.dailySummary.push(row);
    const summary = summarize(state, { branch: row.branch_id, date_from: row.business_date, date_to: row.business_date });

    expect(summary.gross_revenue).toBe(row.rev_normal + row.rev_discount + row.rev_freebie + row.rev_staff);
    expect(summary.cogs).toBe(row.cogs_total);
    expect(summary.wastage_value).toBe(row.wastage_value);
    expect(summary.daily_trend).toContainEqual({
      date: row.business_date,
      revenue: row.rev_normal + row.rev_discount + row.rev_freebie + row.rev_staff,
      profit: row.rev_normal + row.rev_discount + row.rev_freebie + row.rev_staff - row.cogs_total
    });
  });

  it("counts active sales and wastage in the selected branch/date range", () => {
    const state = createSeedState();
    state.sales.push({
      id: "SAL-TEST",
      branch_id: "BR-KASET",
      user_id: "kaset01",
      sale_type: "normal",
      payment_method: "QR1",
      total_amount: 4500,
      cash_received: 0,
      change_given: 0,
      total_cogs: 1800,
      client_created_at: "2026-06-12T02:00:00.000Z",
      server_received_at: "2026-06-12T02:00:00.000Z",
      business_date: "2026-06-12",
      synced_at: "2026-06-12T02:00:00.000Z",
      reconcile_status: "pending",
      status: "active",
      late_after_reconcile: false,
      device_id: "DEV-TEST"
    });
    state.wastage.push({
      id: "WST-TEST",
      wastage_type: "finished",
      branch_id: "BR-KASET",
      user_id: "kaset01",
      product_id: "PRD-KAPRAO",
      qty: 1,
      total_cost_value: 1800,
      lot_breakdown: [],
      created_at: "2026-06-12T02:00:00.000Z"
    });
    const range = { date_from: "2026-06-12", date_to: "2026-06-12" };

    expect(countSales(state, "BR-KASET", range, "normal")).toBe(1);
    expect(countSales(state, "BR-KASET", range, "staff")).toBe(0);
    expect(countWastage(state, "ALL", { date_from: "1900-01-01", date_to: "2999-12-31" })).toBe(state.wastage.length);
  });
});
