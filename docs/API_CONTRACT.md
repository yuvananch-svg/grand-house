# Grand's House API Contract

This build uses the same action names for both the local demo adapter and the Google Apps Script API. The frontend selects the target with `VITE_API_MODE`.

## Frontend API Mode

Create a frontend env file from `frontend/.env.example`.

```dotenv
VITE_API_MODE=local
VITE_GAS_URL=
```

Use `VITE_API_MODE=local` for the browser-local demo backed by `localStorage`. Use `VITE_API_MODE=gas` only after deploying the Apps Script Web App and setting `VITE_GAS_URL` to the deployed Web App URL.

## Request Envelope

```json
{
  "token": "session-token except login",
  "action": "sale.syncBatch",
  "payload": {},
  "device_id": "DEV-..."
}
```

For GAS, send the JSON string as `Content-Type: text/plain;charset=utf-8` to avoid CORS preflight. Request bodies over 200KB are rejected with `PAYLOAD_TOO_LARGE`.

## Response Envelope

```json
{ "ok": true, "data": {}, "catalog_version": 1 }
```

```json
{ "ok": false, "code": "FORBIDDEN", "message": "Forbidden" }
```

HTTP status is not trusted; the caller must use `ok`.

## Implemented Actions

| Action | Roles | Local behavior |
|---|---|---|
| `login` | all | Creates a local session and registers device metadata. |
| `app.snapshot` | all authenticated | Returns the role-scoped app snapshot used by the UI data layer. Heavy transaction tables (`Sales`, `SaleItems`, `Wastage`, `StockMovements`) are limited to the latest 30 Bangkok business days; long-range reports use `report.summary` over `DailySummary`. |
| `product.list` | all | Returns active products and `catalog_version`. |
| `product.images` | all | Returns `{id, image_data}` rows for product photos; clients call it only when product images are missing or `catalog_version` changes. |
| `item.list` | office/owner | Returns the merged Master Item Catalog (`PTG/PGH/RM/PK/SUP`) for dropdowns. |
| `item.save` | owner | Creates/edits/deactivates a catalog item; auto-assigns `item_code` per prefix, writes `PriceHistory` on price change, accepts validated WebP `image_data`, bumps `catalog_version`. Existing rows are partial updates: omitted fields are not overwritten. |
| `stock.myBranch` | staff | Returns finished lots for the staff branch. |
| `sale.syncBatch` | staff | Idempotent sale sync, reserves the sale id before stock writes, treats orphan `SaleItems.sale_id` rows as duplicates, validates sale/payment enums and integer money fields, rejects `TOTAL_MISMATCH` when header total differs from item totals, rejects `BATCH_TOO_LARGE` over 50 sales or 100 items per sale, FIFO COGS, summary update, audit. |
| `sale.void` | staff/owner | Restores lots from `lot_breakdown`; staff follows the 15-minute window. |
| `wastage.create` | staff | Finished-goods wastage by expiry-first lot consumption. |
| `rawWastage.create` | office/owner | Raw lot wastage with FIFO value capture. |
| `stock.extendExpiry` | staff | Extends a finished lot by one day and audits it. |
| `goods.receive` | office/owner | Creates `GoodsReceipts` and a new `FinishedStock` lot. |
| `rawlot.purchase` | office/owner | Creates a `RawLots` row using integer base units. |
| `inventory.list` | office/owner | Returns all inventory tables for local UI. |
| `production.preview` | office/owner | Checks recipe material availability and estimated unit cost. |
| `production.run` | office/owner | Consumes raw FIFO and creates a locked-cost finished lot. |
| `stockAdjust.request` | office/owner | Requires owner approval PIN, locks PIN approval after repeated failures, changes lot quantity, audits suspicious. |
| `reconcile.getDaily` | office/owner | Returns system totals by payment method. |
| `reconcile.confirm` | office/owner | Stores actual totals and marks daily sales reconciled. |
| `expense.create` | office/owner | Stores monthly/supply expense. |
| `expense.list` | office/owner | Lists expenses. |
| `recipe.save` | owner | Saves recipe header/items. |
| `recipe.list` | owner | Lists recipes and recipe items. |
| `report.summary` | owner | Returns revenue, COGS, wastage, expenses, net profit. |
| `report.financialStatement` | owner | Returns income-statement and balance-sheet structure. |
| `audit.query` | owner | Filters audit rows by feature, branch, or flag. |
| `user.manage` | owner | Modes: `add_user`, `update_user`, `reset_password`, `set_pin`, `force_logout`, `block_device`, `unblock_device`, `set_config`. Passwords/PINs share the user's salt column. |
| `maintenance.installTriggers` | owner | Installs the nightly Apps Script triggers and returns trigger status. |
| `maintenance.triggerStatus` | owner | Returns installed/missing nightly trigger status. |
| `maintenance.runTests` | owner | Runs `backend/Tests.gs` and returns the test summary. |
| `log.clientError` | all authenticated | Stores client error diagnostics. |

## Local Credentials

These are seed users for local mode and the current staging sheet. Change these before production use.

| Role | User ID | Password |
|---|---|---|
| Owner | `owner` | `owner1234` |
| Office | `office01` | `office1234` |
| Staff เกษตรใหม่ | `kaset01` | `staff1234` |
| Staff ท่ารั้ว | `tharua01` | `staff1234` |
| Staff บ้านโจ้ | `banjo01` | `staff1234` |

Owner approval PIN in local mode: `246810`.

## Limits And Lockouts

- GAS rate limits requests per principal with `rate_limit_per_min` and across the whole script with `global_rate_limit_per_min`.
- `sale.syncBatch` is capped at 50 sales per request and 100 line items per sale; the Dexie outbox splits larger queued sale batches before sending.
- Owner approval PIN failures use `pin_failed_attempts` and `pin_locked_until`, separate from login `failed_attempts` and `locked_until`.
- Deactivating a user revokes existing sessions; token verification rejects inactive users.
- `wastage.create` and `rawWastage.create` require integer quantities from 1 to 10000. `stock.extendExpiry` tracks `FinishedStock.extend_count`; staff are blocked after two extensions.
- `expense.create` validates `expense_type` and `payment_channel`. Client error logging is capped at 20 rows per device per day.
- Audit `flag` values may be comma-separated when multiple suspicious conditions apply to one row; `audit.query.flag` matches any flag in that set.
