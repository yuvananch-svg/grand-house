# Local Runbook

This project has been implemented as a fresh local-first build from `plan.md`, `Grand's.md`, and `plan2.md`.

## Structure

```text
frontend/   React + Vite + TypeScript + Tailwind + PWA + Dexie outbox
backend/    Google Apps Script source files for later deployment
docs/       API/schema/runbook notes
```

## Local Frontend

The frontend now supports two API modes:

- `VITE_API_MODE=local` uses the browser-local demo adapter.
- `VITE_API_MODE=gas` sends the same request envelope to a deployed Apps Script Web App URL from `VITE_GAS_URL`.

Create an env file from `frontend/.env.example`, then run:

```bash
cd frontend
npm install
npm run dev
```

Then open the dev server URL shown by Vite.

Verification commands:

```bash
npm test
npm run build
npm run test:e2e
```

## Current Local Mode

- `frontend/src/api/client.ts` routes calls by `VITE_API_MODE`.
- Staff actions enter Dexie `outbox` first:
  - `sale.syncBatch`
  - `wastage.create`
  - `stock.extendExpiry`
- When online, `syncEngine` flushes pending outbox rows to the local adapter.
- Office and owner actions are treated as online-only UX flows, but still write to local mock state.
- Local state is stored in `localStorage` key `grands-house-local-state-v1`.
- Session cache and outbox are stored in IndexedDB database `grands-house-local-first`.

## Backend Deployment

The current staging deployment is live:

```text
https://script.google.com/macros/s/AKfycbyC1qRH6VMmLVDTGElhuU2nUlUOzN2udwFOT6pqMC8Ihl4fGwTI7jXaCOcV--kDWPZVqQ/exec
```

Current status:

- Target spreadsheet schema and seed data are installed.
- Web App is deployed as Apps Script version 10.
- `frontend/.env.local` points to the staging Web App with `VITE_API_MODE=gas`.
- Nightly triggers are installed and report `missing: []`.
- The temporary unauthenticated bootstrap endpoint has been removed.

See `docs/GOOGLE_SHEETS_DEPLOY.md` for deploy and maintenance commands.

## Verification Status

- `npm test` passes — 34 Vitest cases across money, freebie repricing, sync engine, ID generation, shared lookup/reporting/audit helpers, item_code uniqueness, sale validation, multi-flag audit, PIN lockout, security validation, and FIFO (`utils/fifo.test.ts` covers the D1 560-baht Lot Overlapping case + non-mutating cost preview for cost-locking).
- `npm run build` passes.
- `npm run test:e2e` runs the Playwright offline-chaos + responsive layout suite. C1-C10 cover staff login, offline sale queueing, multiple queued sales, pending outbox visibility, day-close blocking, wastage queueing, background reconnect sync, navigation persistence, dead-letter rejection handling, cash validation, pending-count recovery, and single stock decrement after sync. R1-R3 lock mobile POS/bottom-nav/cart-sheet behavior, tablet icon-sidebar/product-grid behavior, and mobile table card rendering.
- GitHub Actions `Frontend CI` runs `npm ci`, installs Playwright Chromium, then runs `npm test -- --run`, `npm run build`, and `npm run test:e2e` for `frontend/` on PRs and pushes to `main`/`master`.
- Master Item Catalog (`item.list`/`item.save`, PTG/PGH/RM/PK/SUP codes) + owner "สินค้า" page with Item + Recipe tabs.
- POS: 5 modes incl. "ตัดของเสีย", Numpad for all money entry (No-typing layout), discount/staff price override, freebie bill-total override.
- Owner suite: Inventory 4 tabs + expiry alerts, Production preview ✅/❌ UI, Admin user management + Config editor, AuditLog filters + CSV + hash-chain status, Dashboard 5 ranges (incl. quarter), Financial PDF with embedded Sarabun Thai font + 10-K 3-Part.
- Expenses "ซื้อเข้าคลัง" tab creates a RawLot + linked Expense; `StockMovements` ledger records every stock change.
- GAS performance (GAP-06): `Reports_summary` reads `DailySummary`; `app.snapshot` limits heavy transaction tables to the latest 30 Bangkok business days; `Sales_exists` uses CacheService + TextFinder; nightly rebuild is incremental (yesterday only) and preserves `void_count`; `yearlyArchivePreviousYear` moves prior-year `Sales`, linked `SaleItems`, and `AuditLog` rows to `GrandHouse_Archive_<year>`; daily backups are pruned to 30 days and weekly Sunday backups to 12 weeks.
- Monitoring: dead-letter outbox rows are reported through `log.clientError` as `DEAD_OUTBOX ...`; the morning health report includes yesterday's suspicious audit count/value and dead-outbox report count.
- PWA cache: PDF export chunks (`pdf-*`, `sarabun-*`) are excluded from Workbox precache so staff devices do not download owner-only export assets during app install.
- App split progress: shared UI primitives live in `frontend/src/components/ui.tsx`; shared product visuals live in `frontend/src/components/ProductVisual.tsx`; state-backed selects live in `frontend/src/components/selects.tsx`; pure lookup/date/category helpers live in `frontend/src/domain/lookups.ts`; reporting/date-range summary logic lives in `frontend/src/domain/reporting.ts`; audit chain/CSV helpers live in `frontend/src/domain/audit.ts`; owner Dashboard, Revenue, Audit, Financial, Admin, and Items/Recipe pages live in `frontend/src/pages/owner/`; office GoodsReceive, RawPurchase, Inventory, Production, StockAdjust, Reconcile, and Expenses pages live in `frontend/src/pages/office/`; staff POS, SaleHistory, Wastage, and DayClose pages live in `frontend/src/pages/staff/`. `App.tsx` now mainly owns app shell, auth, sync timers, routing, and error reporting.
- Responsive progress: `SimpleTable` renders mobile card rows by default through `cardOnMobile`, so narrow screens do not need horizontal table scrolling for normal report/admin tables. Mobile app shell now hides the sidebar at phone width and uses a fixed 5-slot bottom tab bar with a "เพิ่มเติม" sheet for secondary pages, language, and logout. Tablet width uses a 72px icon sidebar with title/ARIA labels; at 1024px POS keeps a sticky right cart and 3-column product grid. Mobile POS uses a 2-column product grid and a fixed cart bar above the bottom nav with item count, total, and a quick finish button; adding a product opens the cart sheet with checkout controls. Numpad triggers now share the normal input height/radius/background system while keeping right-aligned numeric text. Browser/e2e audit confirmed no horizontal overflow at 390px, 768px, and 1024px.
- `backend/Tests.gs` — run `runAllTests()` in the Apps Script editor for D1/D3/D7, item_code checks, and production seed-credential guard checks.
- Product card images: SVG placeholders remain as fallback, and owners can upload product photos in the Master Item Catalog. Uploaded images are compressed to WebP and stored in Google Sheets `Products.image_data`.
- Production readiness tooling: `npm run check:prod` validates `.env.production`, local ignored `production.properties`, local ignored `restore-drill.json`, and local ignored `production-smoke.json` before production go-live.

## Still Pending

- Production split: use `docs/PRODUCTION_SPLIT.md` to create the separate production sheet/project and set production-only seed passwords/PINs before `setupSheets()`. Backend bootstrap now rejects demo credentials when `ENV=prod`.
- Optional cleanup: split auth shell/error-boundary/routing helpers out of `App.tsx` if future work needs even smaller files.
