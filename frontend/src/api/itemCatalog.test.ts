import { beforeEach, describe, expect, it } from "vitest";
import type { LocalState, Session } from "../types";
import { createSeedState } from "../data/seed";
import { callLocalApi, getLocalSession, nextItemCode } from "./localAdapter";

beforeEach(() => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => { store.clear(); },
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() { return store.size; }
    },
    configurable: true
  });
});

function stateWith(codes: { products?: string[]; raw?: string[]; supply?: string[] }): LocalState {
  return {
    products: (codes.products || []).map((item_code) => ({ item_code })),
    rawMaterials: (codes.raw || []).map((item_code) => ({ item_code })),
    supplyItems: (codes.supply || []).map((item_code) => ({ item_code }))
  } as unknown as LocalState;
}

describe("nextItemCode", () => {
  it("increments PTG and PGH independently even when names collide across sources", () => {
    const state = stateWith({ products: ["PTG-001", "PTG-002", "PGH-001"] });
    expect(nextItemCode(state, "PTG")).toBe("PTG-003");
    expect(nextItemCode(state, "PGH")).toBe("PGH-002");
  });

  it("starts each prefix at 001 when empty", () => {
    const state = stateWith({});
    expect(nextItemCode(state, "RM")).toBe("RM-001");
    expect(nextItemCode(state, "PK")).toBe("PK-001");
    expect(nextItemCode(state, "SUP")).toBe("SUP-001");
  });

  it("pads to three digits and keeps RM/PK separate", () => {
    const state = stateWith({ raw: ["RM-001", "PK-001", "PK-002", "PK-009"] });
    expect(nextItemCode(state, "RM")).toBe("RM-002");
    expect(nextItemCode(state, "PK")).toBe("PK-010");
  });
});

describe("item.save regression coverage", () => {
  it("toggles active without overwriting product prices or category", async () => {
    const state = createSeedState();
    localStorage.setItem("grands-house-local-state-v1", JSON.stringify(state));
    const session: Session = {
      token: "TEST-TOKEN",
      user_id: "owner",
      display_name: "Owner",
      role: "owner",
      branch_id: "ALL",
      device_id: "TEST-DEVICE",
      expires_at: new Date(Date.now() + 60_000).toISOString()
    };
    localStorage.setItem("grands-house-local-session:TEST-TOKEN", JSON.stringify(session));

    const before = state.products[0];
    const response = await callLocalApi({
      action: "item.save",
      payload: { type: "PTG", id: before.id, name_th: before.name_th, name_my: before.name_my, active: false },
      token: session.token,
      device_id: session.device_id
    });

    expect(response.ok).toBe(true);
    const after = JSON.parse(localStorage.getItem("grands-house-local-state-v1") || "{}") as LocalState;
    const product = after.products.find((item) => item.id === before.id);
    expect(product?.active).toBe(false);
    expect(product?.sell_price).toBe(before.sell_price);
    expect(product?.staff_price).toBe(before.staff_price);
    expect(product?.category).toBe(before.category);
  });

  it("stores product images behind product.images while keeping product.list light", async () => {
    const state = createSeedState();
    localStorage.setItem("grands-house-local-state-v1", JSON.stringify(state));
    const session: Session = {
      token: "TEST-TOKEN-IMG",
      user_id: "owner",
      display_name: "Owner",
      role: "owner",
      branch_id: "ALL",
      device_id: "TEST-DEVICE",
      expires_at: new Date(Date.now() + 60_000).toISOString()
    };
    localStorage.setItem("grands-house-local-session:TEST-TOKEN-IMG", JSON.stringify(session));
    const imageData = `data:image/webp;base64,${"A".repeat(120)}`;

    const saveResponse = await callLocalApi<{ id: string }>({
      action: "item.save",
      payload: {
        type: "PTG",
        name_th: "ข้าวทดสอบ",
        name_my: "test",
        category: "rice_box",
        sell_price: 4500,
        staff_price: 3500,
        shelf_life_days: 1,
        image_data: imageData
      },
      token: session.token,
      device_id: session.device_id
    });

    expect(saveResponse.ok).toBe(true);
    if (!saveResponse.ok) throw new Error(saveResponse.message);
    const productId = saveResponse.data.id;

    const listResponse = await callLocalApi<{ products: { id: string; image_data?: string }[] }>({
      action: "product.list",
      payload: {},
      token: session.token,
      device_id: session.device_id
    });
    expect(listResponse.ok).toBe(true);
    if (!listResponse.ok) throw new Error(listResponse.message);
    expect(listResponse.data.products.find((product) => product.id === productId)?.image_data).toBeUndefined();

    const imagesResponse = await callLocalApi<{ images: { id: string; image_data: string }[] }>({
      action: "product.images",
      payload: {},
      token: session.token,
      device_id: session.device_id
    });
    expect(imagesResponse.ok).toBe(true);
    if (!imagesResponse.ok) throw new Error(imagesResponse.message);
    expect(imagesResponse.data.images.find((product) => product.id === productId)?.image_data).toBe(imageData);
  });
});

describe("sale.syncBatch validation", () => {
  it("rejects a sale when header total does not match item total", async () => {
    const state = createSeedState();
    localStorage.setItem("grands-house-local-state-v1", JSON.stringify(state));
    const session: Session = {
      token: "TEST-TOKEN-2",
      user_id: "kaset01",
      display_name: "Staff",
      role: "staff",
      branch_id: "BR-KASET",
      device_id: "TEST-DEVICE",
      expires_at: new Date(Date.now() + 60_000).toISOString()
    };
    localStorage.setItem("grands-house-local-session:TEST-TOKEN-2", JSON.stringify(session));
    const product = state.products[0];

    const response = await callLocalApi<{ results: { status: string; code: string }[] }>({
      action: "sale.syncBatch",
      payload: {
        sales: [{
          id: "SALE-BAD-TOTAL",
          branch_id: "BR-KASET",
          user_id: session.user_id,
          sale_type: "normal",
          payment_method: "QR1",
          total_amount: 1,
          cash_received: 0,
          change_given: 0,
          client_created_at: new Date().toISOString(),
          device_id: session.device_id,
          items: [{ id: "SIT-BAD-TOTAL", product_id: product.id, qty: 1, unit_price: product.sell_price, is_freebie: false }]
        }]
      },
      token: session.token,
      device_id: session.device_id
    });

    expect(response.ok).toBe(true);
    if (!response.ok) throw new Error(response.message);
    expect(response.data.results[0]).toMatchObject({ status: "rejected", code: "TOTAL_MISMATCH" });
    const after = JSON.parse(localStorage.getItem("grands-house-local-state-v1") || "{}") as LocalState;
    expect(after.sales.some((sale) => sale.id === "SALE-BAD-TOTAL")).toBe(false);
  });

  it("rejects batches over 50 sales before writing any sale", async () => {
    const state = createSeedState();
    localStorage.setItem("grands-house-local-state-v1", JSON.stringify(state));
    const session: Session = {
      token: "TEST-TOKEN-3",
      user_id: "kaset01",
      display_name: "Staff",
      role: "staff",
      branch_id: "BR-KASET",
      device_id: "TEST-DEVICE",
      expires_at: new Date(Date.now() + 60_000).toISOString()
    };
    localStorage.setItem("grands-house-local-session:TEST-TOKEN-3", JSON.stringify(session));
    const product = state.products[0];
    const sales = Array.from({ length: 51 }, (_, index) => ({
      id: `SALE-BIG-${index}`,
      branch_id: "BR-KASET" as const,
      user_id: session.user_id,
      sale_type: "normal" as const,
      payment_method: "QR1" as const,
      total_amount: product.sell_price,
      cash_received: 0,
      change_given: 0,
      client_created_at: new Date().toISOString(),
      device_id: session.device_id,
      items: [{ id: `SIT-BIG-${index}`, product_id: product.id, qty: 1, unit_price: product.sell_price, is_freebie: false }]
    }));

    const response = await callLocalApi({ action: "sale.syncBatch", payload: { sales }, token: session.token, device_id: session.device_id });

    expect(response.ok).toBe(false);
    if (response.ok) throw new Error("Expected oversized batch to fail");
    expect(response.code).toBe("BATCH_TOO_LARGE");
    const after = JSON.parse(localStorage.getItem("grands-house-local-state-v1") || "{}") as LocalState;
    expect(after.sales.some((sale) => sale.id.startsWith("SALE-BIG-"))).toBe(false);
  });

  it("keeps multiple audit flags on one suspicious oversold sale", async () => {
    const state = createSeedState();
    localStorage.setItem("grands-house-local-state-v1", JSON.stringify(state));
    const session: Session = {
      token: "TEST-TOKEN-5",
      user_id: "kaset01",
      display_name: "Staff",
      role: "staff",
      branch_id: "BR-KASET",
      device_id: "TEST-DEVICE",
      expires_at: new Date(Date.now() + 60_000).toISOString()
    };
    localStorage.setItem("grands-house-local-session:TEST-TOKEN-5", JSON.stringify(session));
    const product = state.products[0];

    const response = await callLocalApi<{ results: { status: string; flag: string }[] }>({
      action: "sale.syncBatch",
      payload: {
        sales: [{
          id: "SALE-MULTI-FLAG",
          branch_id: "BR-KASET",
          user_id: session.user_id,
          sale_type: "normal",
          payment_method: "QR1",
          total_amount: 100,
          cash_received: 0,
          change_given: 0,
          client_created_at: new Date().toISOString(),
          device_id: session.device_id,
          items: [{ id: "SIT-MULTI-FLAG", product_id: product.id, qty: 100, unit_price: 1, is_freebie: false }]
        }]
      },
      token: session.token,
      device_id: session.device_id
    });

    expect(response.ok).toBe(true);
    if (!response.ok) throw new Error(response.message);
    expect(response.data.results[0].flag.split(",")).toEqual(expect.arrayContaining(["PRICE_OVERRIDE", "SUSPICIOUS", "OVERSOLD"]));
  });

  it("treats orphan sale items as duplicate to avoid double stock cuts on retry", async () => {
    const state = createSeedState();
    const product = state.products[0];
    const lot = state.finishedLots.find((item) => item.branch_id === "BR-KASET" && item.product_id === product.id);
    if (!lot) throw new Error("Missing seed lot");
    const beforeQty = lot.qty_remaining;
    state.saleItems.push({
      id: "SIT-ORPHAN",
      sale_id: "SALE-ORPHAN-RETRY",
      product_id: product.id,
      qty: 1,
      unit_price: product.sell_price,
      is_freebie: false,
      unit_cost: lot.unit_cost,
      lot_breakdown: [{ lot_id: lot.lot_id, qty: 1, unit_cost: lot.unit_cost }]
    });
    localStorage.setItem("grands-house-local-state-v1", JSON.stringify(state));
    const session: Session = {
      token: "TEST-TOKEN-ORPHAN",
      user_id: "kaset01",
      display_name: "Staff",
      role: "staff",
      branch_id: "BR-KASET",
      device_id: "TEST-DEVICE",
      expires_at: new Date(Date.now() + 60_000).toISOString()
    };
    localStorage.setItem("grands-house-local-session:TEST-TOKEN-ORPHAN", JSON.stringify(session));

    const response = await callLocalApi<{ results: { status: string }[] }>({
      action: "sale.syncBatch",
      payload: {
        sales: [{
          id: "SALE-ORPHAN-RETRY",
          branch_id: "BR-KASET",
          user_id: session.user_id,
          sale_type: "normal",
          payment_method: "QR1",
          total_amount: product.sell_price,
          cash_received: 0,
          change_given: 0,
          client_created_at: new Date().toISOString(),
          device_id: session.device_id,
          items: [{ id: "SIT-ORPHAN-RETRY", product_id: product.id, qty: 1, unit_price: product.sell_price, is_freebie: false }]
        }]
      },
      token: session.token,
      device_id: session.device_id
    });

    expect(response.ok).toBe(true);
    if (!response.ok) throw new Error(response.message);
    expect(response.data.results[0]).toMatchObject({ status: "duplicate" });
    const after = JSON.parse(localStorage.getItem("grands-house-local-state-v1") || "{}") as LocalState;
    expect(after.sales.some((sale) => sale.id === "SALE-ORPHAN-RETRY")).toBe(false);
    expect(after.finishedLots.find((item) => item.lot_id === lot.lot_id)?.qty_remaining).toBe(beforeQty);
  });
});

describe("stockAdjust PIN lockout", () => {
  it("locks owner PIN approval after repeated failures", async () => {
    const state = createSeedState();
    localStorage.setItem("grands-house-local-state-v1", JSON.stringify(state));
    const session: Session = {
      token: "TEST-TOKEN-4",
      user_id: "office01",
      display_name: "Office",
      role: "office",
      branch_id: "ALL",
      device_id: "TEST-DEVICE",
      expires_at: new Date(Date.now() + 60_000).toISOString()
    };
    localStorage.setItem("grands-house-local-session:TEST-TOKEN-4", JSON.stringify(session));
    const lot = state.finishedLots[0];
    const payload = {
      target_type: "finished_lot",
      lot_id: lot.lot_id,
      qty_after: lot.qty_remaining,
      reason: "test",
      owner_pin: "000000"
    };

    for (let index = 0; index < state.config.login_lockout_attempts; index += 1) {
      const response = await callLocalApi({ action: "stockAdjust.request", payload, token: session.token, device_id: session.device_id });
      expect(response.ok).toBe(false);
    }

    const lockedState = JSON.parse(localStorage.getItem("grands-house-local-state-v1") || "{}") as LocalState;
    const owner = lockedState.users.find((user) => user.role === "owner");
    expect(owner?.pin_failed_attempts).toBe(state.config.login_lockout_attempts);
    expect(owner?.pin_locked_until).toBeTruthy();

    const lockedResponse = await callLocalApi({
      action: "stockAdjust.request",
      payload: { ...payload, owner_pin: "246810" },
      token: session.token,
      device_id: session.device_id
    });
    expect(lockedResponse.ok).toBe(false);
    if (lockedResponse.ok) throw new Error("Expected locked PIN to fail");
    expect(lockedResponse.code).toBe("PIN_LOCKED");
  });
});

describe("security hardening regressions", () => {
  it("revokes local sessions when a user is deactivated", async () => {
    const state = createSeedState();
    localStorage.setItem("grands-house-local-state-v1", JSON.stringify(state));
    const ownerSession: Session = {
      token: "TEST-TOKEN-OWNER-REVOKE",
      user_id: "owner",
      display_name: "Owner",
      role: "owner",
      branch_id: "ALL",
      device_id: "OWNER-DEVICE",
      expires_at: new Date(Date.now() + 60_000).toISOString()
    };
    const staffSession: Session = {
      token: "TEST-TOKEN-STAFF-REVOKE",
      user_id: "kaset01",
      display_name: "Staff",
      role: "staff",
      branch_id: "BR-KASET",
      device_id: "STAFF-DEVICE",
      expires_at: new Date(Date.now() + 60_000).toISOString()
    };
    localStorage.setItem("grands-house-local-session:TEST-TOKEN-OWNER-REVOKE", JSON.stringify(ownerSession));
    localStorage.setItem("grands-house-local-session:TEST-TOKEN-STAFF-REVOKE", JSON.stringify(staffSession));
    const user = state.users.find((item) => item.user_id === "kaset01");
    if (!user) throw new Error("Missing seed staff user");

    const manageResponse = await callLocalApi({
      action: "user.manage",
      payload: { mode: "update_user", id: user.id, user: { active: false } },
      token: ownerSession.token,
      device_id: ownerSession.device_id
    });

    expect(manageResponse.ok).toBe(true);
    expect(getLocalSession(staffSession.token)).toBeNull();
    const staffResponse = await callLocalApi({ action: "stock.myBranch", payload: {}, token: staffSession.token, device_id: staffSession.device_id });
    expect(staffResponse.ok).toBe(false);
    if (staffResponse.ok) throw new Error("Expected deactivated staff session to fail");
    expect(staffResponse.code).toBe("AUTH_EXPIRED");
  });

  it("limits staff expiry extensions after two extensions", async () => {
    const state = createSeedState();
    localStorage.setItem("grands-house-local-state-v1", JSON.stringify(state));
    const session: Session = {
      token: "TEST-TOKEN-EXTEND",
      user_id: "kaset01",
      display_name: "Staff",
      role: "staff",
      branch_id: "BR-KASET",
      device_id: "TEST-DEVICE",
      expires_at: new Date(Date.now() + 60_000).toISOString()
    };
    localStorage.setItem("grands-house-local-session:TEST-TOKEN-EXTEND", JSON.stringify(session));
    const lot = state.finishedLots.find((item) => item.branch_id === "BR-KASET");
    if (!lot) throw new Error("Missing seed lot");

    expect((await callLocalApi({ action: "stock.extendExpiry", payload: { lot_id: lot.lot_id }, token: session.token, device_id: session.device_id })).ok).toBe(true);
    expect((await callLocalApi({ action: "stock.extendExpiry", payload: { lot_id: lot.lot_id }, token: session.token, device_id: session.device_id })).ok).toBe(true);
    const third = await callLocalApi({ action: "stock.extendExpiry", payload: { lot_id: lot.lot_id }, token: session.token, device_id: session.device_id });
    expect(third.ok).toBe(false);
    if (third.ok) throw new Error("Expected third staff extension to fail");
    expect(third.code).toBe("EXTEND_LIMIT");
  });

  it("caps client error logs per device per day", async () => {
    const state = createSeedState();
    localStorage.setItem("grands-house-local-state-v1", JSON.stringify(state));
    const session: Session = {
      token: "TEST-TOKEN-ERROR-CAP",
      user_id: "kaset01",
      display_name: "Staff",
      role: "staff",
      branch_id: "BR-KASET",
      device_id: "ERROR-DEVICE",
      expires_at: new Date(Date.now() + 60_000).toISOString()
    };
    localStorage.setItem("grands-house-local-session:TEST-TOKEN-ERROR-CAP", JSON.stringify(session));

    for (let index = 0; index < 20; index += 1) {
      const response = await callLocalApi({ action: "log.clientError", payload: { message: `boom ${index}` }, token: session.token, device_id: session.device_id });
      expect(response.ok).toBe(true);
    }
    const capped = await callLocalApi({ action: "log.clientError", payload: { message: "boom capped" }, token: session.token, device_id: session.device_id });
    expect(capped.ok).toBe(false);
    if (capped.ok) throw new Error("Expected error log cap");
    expect(capped.code).toBe("ERROR_LOG_RATE_LIMITED");
  });

  it("keeps void_count when a synced sale is voided", async () => {
    const state = createSeedState();
    localStorage.setItem("grands-house-local-state-v1", JSON.stringify(state));
    const session: Session = {
      token: "TEST-TOKEN-VOID-SUMMARY",
      user_id: "kaset01",
      display_name: "Staff",
      role: "staff",
      branch_id: "BR-KASET",
      device_id: "VOID-DEVICE",
      expires_at: new Date(Date.now() + 60_000).toISOString()
    };
    localStorage.setItem("grands-house-local-session:TEST-TOKEN-VOID-SUMMARY", JSON.stringify(session));
    const lot = state.finishedLots.find((item) => item.branch_id === "BR-KASET" && item.qty_remaining > 0);
    if (!lot) throw new Error("Missing seed lot");
    const product = state.products.find((item) => item.id === lot.product_id);
    if (!product) throw new Error("Missing seed product");

    const saleResponse = await callLocalApi({
      action: "sale.syncBatch",
      payload: {
        sales: [{
          id: "SALE-VOID-SUMMARY",
          branch_id: "BR-KASET",
          user_id: session.user_id,
          sale_type: "normal",
          payment_method: "QR1",
          total_amount: product.sell_price,
          cash_received: 0,
          change_given: 0,
          client_created_at: new Date().toISOString(),
          device_id: session.device_id,
          items: [{ id: "SIT-VOID-SUMMARY", product_id: product.id, qty: 1, unit_price: product.sell_price, is_freebie: false }]
        }]
      },
      token: session.token,
      device_id: session.device_id
    });
    expect(saleResponse.ok).toBe(true);

    const voidResponse = await callLocalApi({
      action: "sale.void",
      payload: { sale_id: "SALE-VOID-SUMMARY", reason: "test" },
      token: session.token,
      device_id: session.device_id
    });
    expect(voidResponse.ok).toBe(true);

    const after = JSON.parse(localStorage.getItem("grands-house-local-state-v1") || "{}") as LocalState;
    const sale = after.sales.find((item) => item.id === "SALE-VOID-SUMMARY");
    if (!sale) throw new Error("Missing synced sale");
    const summary = after.dailySummary.find((item) => item.branch_id === sale.branch_id && item.business_date === sale.business_date);
    expect(sale.status).toBe("voided");
    expect(summary?.void_count).toBe(1);
    expect(summary?.bill_count).toBe(0);
    expect(summary?.rev_normal).toBe(0);
    expect(summary?.pay_qr1).toBe(0);
  });
});
