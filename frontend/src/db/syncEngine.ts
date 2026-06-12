import { callApi } from "../api/client";
import type { ApiAction, BranchId, FinishedLot, OutboxItem, Session } from "../types";
import { makeId, nowIso } from "../utils/ids";
import { db } from "./dexie";

type SyncBatchApiData = {
  results?: { id?: string; status?: string; code?: string; message?: string }[];
  stock?: FinishedLot[];
};

const MAX_SALES_PER_BATCH = 50;

function stockRowsFromLots(lots: FinishedLot[]) {
  const totals = new Map<string, { product_id: string; branch_id: BranchId; qty_remaining: number }>();
  lots.forEach((lot) => {
    const key = `${lot.branch_id}:${lot.product_id}`;
    const current = totals.get(key) || { product_id: lot.product_id, branch_id: lot.branch_id, qty_remaining: 0 };
    current.qty_remaining += Number(lot.qty_remaining || 0);
    totals.set(key, current);
  });
  const updated_at = new Date().toISOString();
  return [...totals.values()].map((row) => ({ ...row, updated_at }));
}

async function cacheStockSnapshot(data: unknown): Promise<void> {
  const stock = (data as SyncBatchApiData | undefined)?.stock;
  if (!Array.isArray(stock)) return;
  const rows = stockRowsFromLots(stock);
  if (!rows.length) return;
  await db.stockCache.bulkPut(rows);
}

export function rejectedBatchMessage(data: unknown): string | null {
  const results = (data as SyncBatchApiData | undefined)?.results || [];
  const rejected = results.filter((result) => result.status === "rejected");
  if (!rejected.length) return null;
  return rejected.map((result) => `${result.id || "unknown"}:${result.code || result.message || "rejected"}`).join(", ");
}

export async function queueStaffAction(type: ApiAction, payload: unknown): Promise<OutboxItem> {
  const item: OutboxItem = {
    id: makeId("OUT"),
    type,
    payload,
    created_at: nowIso(),
    status: "pending"
  };
  await db.outbox.put(item);
  return item;
}

export async function getOutboxCount(): Promise<number> {
  return db.outbox.where("status").anyOf(["pending", "failed"]).count();
}

export async function listOutbox(): Promise<OutboxItem[]> {
  return db.outbox.orderBy("created_at").toArray();
}

export async function removeQueuedLocalSale(saleId: string): Promise<boolean> {
  const items = await db.outbox.where("type").equals("sale.syncBatch").toArray();
  const match = items.find((item) => {
    const payload = item.payload as { sales?: { id: string }[] };
    return payload.sales?.some((sale) => sale.id === saleId);
  });
  if (!match) return false;
  await db.outbox.delete(match.id);
  return true;
}

export async function flushOutbox(session: Session | null): Promise<{ sent: number; failed: number }> {
  if (!session || !navigator.onLine) return { sent: 0, failed: 0 };
  const pending = await db.outbox.where("status").anyOf(["pending", "failed"]).sortBy("created_at");
  let sent = 0;
  let failed = 0;

  for (const item of pending) {
    await db.outbox.update(item.id, { status: "sending", last_error: undefined });
    const response = item.type === "sale.syncBatch"
      ? await flushSaleBatch(item.payload, session)
      : await callApi(item.type, item.payload, session);
    if (response.ok) {
      if (item.type === "sale.syncBatch") await cacheStockSnapshot(response.data);
      const rejectedMessage = item.type === "sale.syncBatch" ? rejectedBatchMessage(response.data) : null;
      if (rejectedMessage) {
        await logDeadOutbox(item, rejectedMessage, session);
        await db.outbox.delete(item.id);
        await db.outbox.put({
          ...item,
          id: makeId("DEAD"),
          status: "dead",
          last_error: rejectedMessage
        });
        failed += 1;
        continue;
      }
      await db.outbox.delete(item.id);
      sent += 1;
    } else {
      await db.outbox.update(item.id, { status: "failed", last_error: response.message });
      failed += 1;
    }
  }

  return { sent, failed };
}

async function logDeadOutbox(item: OutboxItem, error: string, session: Session): Promise<void> {
  try {
    await callApi("log.clientError", {
      message: `DEAD_OUTBOX ${item.type}: ${error}`,
      stack: JSON.stringify({ outbox_id: item.id, created_at: item.created_at }).slice(0, 1000),
      url: location.href
    }, session);
  } catch {
    // The dead-letter row is still persisted locally; this report is best-effort monitoring.
  }
}

async function flushSaleBatch(payload: unknown, session: Session) {
  const sales = (payload as { sales?: unknown[] }).sales || [];
  if (sales.length <= MAX_SALES_PER_BATCH) return callApi("sale.syncBatch", payload, session);

  const combined: SyncBatchApiData = { results: [], stock: [] };
  for (let index = 0; index < sales.length; index += MAX_SALES_PER_BATCH) {
    const response = await callApi("sale.syncBatch", { sales: sales.slice(index, index + MAX_SALES_PER_BATCH) }, session);
    if (!response.ok) return response;
    const data = response.data as SyncBatchApiData;
    combined.results?.push(...(data.results || []));
    combined.stock = data.stock || combined.stock;
  }
  return { ok: true, data: combined } as const;
}
