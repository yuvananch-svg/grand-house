import { callApi } from "../api/client";
import { resetLocalState } from "../api/localAdapter";
import { createSeedState } from "../data/seed";
import { cacheAppState, db, getCachedAppState } from "../db/dexie";
import type { BranchId, FinishedLot, LocalState, Product, Session } from "../types";

type SnapshotPayload = Partial<LocalState> & { catalog_version?: number };
type ProductImagesPayload = { images?: { id: string; image_data?: string }[] };
type LoadAppDataOptions = { mode?: "snapshot" | "light" };

function mergeState(base: LocalState, patch: Partial<LocalState>): LocalState {
  const imageById = new Map(base.products.map((product) => [product.id, product.image_data]));
  const products = patch.products?.map((product) => (
    product.image_data === undefined && imageById.has(product.id)
      ? { ...product, image_data: imageById.get(product.id) }
      : product
  ));
  return {
    ...base,
    ...patch,
    ...(products ? { products } : {}),
    config: { ...base.config, ...(patch.config || {}) }
  };
}

async function cacheFastTables(state: LocalState): Promise<void> {
  await db.transaction("rw", db.products, db.stockCache, async () => {
    await db.products.clear();
    await db.products.bulkPut(state.products);
    await db.stockCache.clear();
    await db.stockCache.bulkPut(stockRowsFromLots(state.finishedLots));
  });
}

function mergeProductImages(state: LocalState, images: ProductImagesPayload): LocalState {
  const byId = new Map((images.images || []).map((item) => [item.id, item.image_data || ""]));
  if (!byId.size) return state;
  return {
    ...state,
    products: state.products.map((product) => (byId.has(product.id) ? { ...product, image_data: byId.get(product.id) || "" } : product))
  };
}

async function loadProductImages(state: LocalState, session: Session): Promise<LocalState> {
  const response = await callApi<ProductImagesPayload>("product.images", {}, session);
  return response.ok ? mergeProductImages(state, response.data) : state;
}

function needsProductImages(state: LocalState, previousCatalogVersion?: number, nextCatalogVersion?: number): boolean {
  return state.products.some((product) => product.image_data === undefined) || (!!nextCatalogVersion && nextCatalogVersion !== previousCatalogVersion);
}

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

async function updateFromEndpoint<T>(
  state: LocalState,
  action: Parameters<typeof callApi<T>>[0],
  payload: unknown,
  session: Session,
  apply: (next: LocalState, data: T) => LocalState
): Promise<LocalState> {
  const response = await callApi<T>(action, payload, session);
  if (!response.ok) return state;
  return apply(state, response.data);
}

export async function getInitialAppData(): Promise<LocalState> {
  return (await getCachedAppState()) || createSeedState();
}

export async function loadAppData(session: Session | null, options: LoadAppDataOptions = {}): Promise<LocalState> {
  const cached = await getCachedAppState();
  let state = cached || createSeedState();
  if (!session) return state;

  if (options.mode !== "light") {
    const snapshot = await callApi<SnapshotPayload>("app.snapshot", {}, session);
    if (snapshot.ok) {
      const previousCatalogVersion = state.config.catalog_version;
      state = mergeState(state, snapshot.data);
      const nextCatalogVersion = snapshot.catalog_version || snapshot.data.catalog_version || state.config.catalog_version;
      if (needsProductImages(state, previousCatalogVersion, nextCatalogVersion)) state = await loadProductImages(state, session);
      await cacheFastTables(state);
      await cacheAppState(state, snapshot.catalog_version || snapshot.data.catalog_version);
      return state;
    }
  }

  const previousCatalogVersion = state.config.catalog_version;
  const productsResponse = await callApi<{ products: Product[]; catalog_version?: number }>("product.list", {}, session);
  if (productsResponse.ok) {
    state = mergeState(state, { products: productsResponse.data.products || state.products });
    if (needsProductImages(state, previousCatalogVersion, productsResponse.data.catalog_version)) state = await loadProductImages(state, session);
  }

  state = await updateFromEndpoint<FinishedLot[]>(
    state,
    "stock.myBranch",
    { branch_id: session.branch_id },
    session,
    (next, data) => {
      const branch_id = session.branch_id;
      const otherLots = branch_id === "ALL" ? [] : next.finishedLots.filter((lot) => lot.branch_id !== branch_id);
      return { ...next, finishedLots: [...otherLots, ...(data || [])] };
    }
  );

  if (session.role !== "staff") {
    state = await updateFromEndpoint<Pick<LocalState, "products" | "finishedLots" | "rawMaterials" | "supplyItems" | "rawLots" | "stockMovements">>(
      state,
      "inventory.list",
      {},
      session,
      (next, data) => ({ ...next, ...data })
    );
    state = await updateFromEndpoint<Pick<LocalState, "recipes" | "recipeItems">>(
      state,
      "recipe.list",
      {},
      session,
      (next, data) => ({ ...next, recipes: data.recipes || [], recipeItems: data.recipeItems || [] })
    );
    state = await updateFromEndpoint<LocalState["expenses"]>(
      state,
      "expense.list",
      {},
      session,
      (next, data) => ({ ...next, expenses: data || [] })
    );
  }

  if (session.role === "owner") {
    state = await updateFromEndpoint<LocalState["auditLog"]>(
      state,
      "audit.query",
      {},
      session,
      (next, data) => ({ ...next, auditLog: data || [] })
    );
  }

  await cacheFastTables(state);
  await cacheAppState(state);
  return state;
}

export async function resetDemoData(): Promise<LocalState> {
  const state = resetLocalState();
  await cacheFastTables(state);
  await cacheAppState(state, state.config.catalog_version);
  return state;
}
