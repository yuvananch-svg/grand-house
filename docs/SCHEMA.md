# Grand's House Schema Notes

`backend/SheetDB.gs` contains the current header source of truth (25 sheets).

## Sheets

1. `Users` — includes login lockout (`failed_attempts`, `locked_until`) and separate owner-PIN lockout (`pin_failed_attempts`, `pin_locked_until`)
2. `Branches`
3. `Products` — includes `item_code` (`PTG-xxx` parent / `PGH-xxx` self-produced); `category` is one of `rice_box`, `savory`, `drink`, `dessert`, `snack`, `other`; optional `image_data` stores a WebP data URL and is appended as the last column for safe migration
4. `FinishedStock` — includes `extend_count` for expiry-extension governance; staff can extend a lot at most twice before office/owner review
5. `Sales`
6. `SaleItems`
7. `Wastage`
8. `RawMaterials` — includes `item_code` (`RM-xxx` raw / `PK-xxx` packaging)
9. `SupplyItems` — untracked supplies (`SUP-xxx`): `id, item_code, name_th, name_my, category, unit, active`
10. `StockMovements` — ledger of every stock change: `id, date, branch_id, lot_id, item_code, type, qty_change, value_change, ref_id`
11. `RawLots`
12. `Recipes`
13. `RecipeItems`
14. `ProductionOrders`
15. `GoodsReceipts`
16. `StockAdjustments`
17. `Reconciliations`
18. `Expenses` — extended with `payment_channel, purchase_qty, item_code, ref_id`
19. `AuditLog`
20. `Sessions`
21. `DailySummary`
22. `PriceHistory`
23. `ErrorLog`
24. `Devices`
25. `Config` — includes per-principal `rate_limit_per_min` and script-wide `global_rate_limit_per_min`

## Master Item Catalog (approve2 §4.1)

A single catalog drives every dropdown. Items are classified by code prefix:

| Prefix | Meaning | Stored in |
|---|---|---|
| `PTG-xxx` | Parent finished goods (The Grand's) | `Products.source_type='parent'` |
| `PGH-xxx` | Self-produced finished goods | `Products.source_type='self_produced'` |
| `RM-xxx` | Raw material (fresh/dry) | `RawMaterials.is_packaging=false` |
| `PK-xxx` | Packaging | `RawMaterials.is_packaging=true` |
| `SUP-xxx` | Untracked supply | `SupplyItems` |

`item.save` (owner only) auto-assigns the next zero-padded running number per prefix under a script lock. Editing `sell_price`/`staff_price` writes a `PriceHistory` row + `PRICE_CHANGE` audit and bumps `catalog_version`. Existing rows accept partial updates: fields omitted from the payload are left unchanged. Items are deactivated (`active=false`), never deleted.

Finished-goods POS category buttons are derived from `Products.category` plus `Products.source_type`: "ข้าวกล่อง (G)" means `category='rice_box'` and `source_type='parent'`; "ข้าวกล่อง (GH)" means `category='rice_box'` and `source_type='self_produced'`.

Product images uploaded in the owner catalog are compressed client-side to 300x300 WebP and stored in `Products.image_data` when the data URL is under 45KB. Normal snapshot/product endpoints omit `image_data`; clients load it through `product.images` when `catalog_version` changes.

## Important Implementation Rules

- Money is stored as integer satang everywhere.
- Raw material quantities are stored as integer base units:
  - `g` for weight
  - `ml` for volume
  - `piece` for count
- Display conversion is UI-only via `display_unit` and `display_factor`.
- Sales and wastage store `lot_breakdown` JSON for traceability.
- Wastage quantities are server-validated as integer `1..10000`.
- Production stores `consumption_detail` JSON to preserve FIFO raw-lot usage.
- Historical rows are not deleted. Void, price changes, recipe changes, and adjustments are state changes with audit rows.
- `AuditLog` has a tamper-evident hash chain: `prev_hash` + row content -> `row_hash`.
- `AuditLog.flag` can contain multiple comma-separated flags, e.g. `PRICE_OVERRIDE,SUSPICIOUS,OVERSOLD`; filters must treat it as a set.

## Local Data

The local app seeds mock data in `frontend/src/data/seed.ts`. It is intentionally new sample data for this build and does not reuse older repository code or historic app data.
