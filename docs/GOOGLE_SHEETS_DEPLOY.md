# Google Sheets + GAS Deploy Runbook

Target spreadsheet:

```text
SPREADSHEET_ID=1KVcBLhDNuWPUxAm-Sdkjs-CCtp1N16oqWwZn3WEFz8M
```

Current Web App:

```text
https://script.google.com/macros/s/AKfycbyC1qRH6VMmLVDTGElhuU2nUlUOzN2udwFOT6pqMC8Ihl4fGwTI7jXaCOcV--kDWPZVqQ/exec
```

Current Apps Script project:

```text
SCRIPT_ID=1Xzz0snshjrKPARtefcVyV5H1FT3kLPLhOitWGIn1UqxpjUF1hPJeeRo3
```

## Current Status

- `clasp` is logged in for the deployment account.
- The schema and seed data have been applied to the target spreadsheet.
- The Web App URL above is deployed as version 10.
- The temporary unauthenticated bootstrap endpoint has been removed.
- Old bootstrap/staging deployments have been undeployed; only the version 10 Web App and HEAD deployment remain.
- Nightly triggers are installed: `yearlyArchivePreviousYear`, `nightlyRebuildDailySummary`, `nightlyVerifyAuditChain`, `nightlyBackupSpreadsheet`, `nightlyPruneSessions`, and `morningHealthReport`.

## Script Properties

Set these in the Apps Script project before smoke testing:

| Key | Value |
|---|---|
| `SPREADSHEET_ID` | `1KVcBLhDNuWPUxAm-Sdkjs-CCtp1N16oqWwZn3WEFz8M` |
| `PEPPER` | generated deployment secret, must match seeded `Users.password_hash` |
| `ALERT_EMAIL` | owner alert email |
| `ENV` | `staging` or `prod` |

For `ENV=prod`, also set all `SEED_*` credential properties before `setupSheets()`. See `docs/PRODUCTION_SPLIT.md`.

Do not commit `PEPPER` or `.env.local`.

Before production go-live, run the local readiness check from `docs/PRODUCTION_SPLIT.md`. It validates `.env.production`, local ignored `production.properties`, local ignored `restore-drill.json`, and local ignored `production-smoke.json` without printing secrets.

## Deploy Steps

```bash
cd "/Users/yuvananchan-arkat/Desktop/claude plan"
npx @google/clasp push --force
npx @google/clasp version "describe the change"
npx @google/clasp deploy -i AKfycbyC1qRH6VMmLVDTGElhuU2nUlUOzN2udwFOT6pqMC8Ihl4fGwTI7jXaCOcV--kDWPZVqQ -V <version> -d "staging web app"
```

## Setup / Maintenance

Initial setup has already been run. If a new spreadsheet or deployment is created, run these from Apps Script after setting Script Properties:

1. `setupSheets()`
2. `installNightlyTriggers()`
3. `runAllTests()`

Production setup is intentionally stricter than staging: `setupSheets()` rejects missing seed credentials, demo passwords, or demo owner PIN when `ENV=prod`.

The deployed Web App also exposes owner-only maintenance actions:

- `maintenance.installTriggers`
- `maintenance.triggerStatus`
- `maintenance.runTests`

Both require a valid owner session token.

## Frontend Env

For local development, `frontend/.env.local` should contain:

```dotenv
VITE_API_MODE=gas
VITE_GAS_URL=https://script.google.com/macros/s/AKfycbyC1qRH6VMmLVDTGElhuU2nUlUOzN2udwFOT6pqMC8Ihl4fGwTI7jXaCOcV--kDWPZVqQ/exec
```

Then verify:

```bash
cd frontend
npm test
npm run build
npm run dev -- --host 0.0.0.0 --port 4321 --strictPort
```

Smoke path:

1. Login owner.
2. Login staff branch.
3. Create sale.
4. Void within window.
5. Create wastage.
6. Reconcile day.
7. Confirm dashboard totals match `DailySummary`.

For production, record the completed smoke result in `production-smoke.json` using `docs/production-smoke.example.json` as the template. The recorded `web_app_url` must match `.env.production` exactly.
