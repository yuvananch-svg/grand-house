import Dexie, { type Table } from "dexie";
import type { LocalState, OutboxItem, Product, Session } from "../types";

export interface StockCacheRow {
  product_id: string;
  branch_id: string;
  qty_remaining: number;
  updated_at: string;
}

class GrandsHouseDB extends Dexie {
  outbox!: Table<OutboxItem, string>;
  products!: Table<Product, string>;
  stockCache!: Table<StockCacheRow, [string, string]>;
  session!: Table<{ key: string; value: Session }, string>;
  appCache!: Table<{ key: string; value: LocalState; catalog_version?: number; updated_at: string }, string>;

  constructor() {
    super("grands-house-local-first");
    this.version(1).stores({
      outbox: "id, type, created_at, status",
      products: "id, category",
      stockCache: "product_id, branch_id",
      session: "key"
    });
    this.version(2).stores({
      outbox: "id, type, created_at, status",
      products: "id, category",
      stockCache: "[branch_id+product_id], branch_id, product_id",
      session: "key",
      appCache: "key, updated_at"
    });
  }
}

export const db = new GrandsHouseDB();

export async function cacheSession(session: Session): Promise<void> {
  await db.session.put({ key: "current", value: session });
}

export async function getCachedSession(): Promise<Session | null> {
  const row = await db.session.get("current");
  return row?.value || null;
}

export async function clearCachedSession(): Promise<void> {
  await db.session.delete("current");
}

export async function cacheAppState(state: LocalState, catalogVersion?: number): Promise<void> {
  await db.appCache.put({ key: "current", value: state, catalog_version: catalogVersion, updated_at: new Date().toISOString() });
}

export async function getCachedAppState(): Promise<LocalState | null> {
  const row = await db.appCache.get("current");
  return row?.value || null;
}
