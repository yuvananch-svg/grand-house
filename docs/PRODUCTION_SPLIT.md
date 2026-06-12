# Production Split Runbook

Use this before real daily operations. Staging and production must not share a spreadsheet, Apps Script project, Web App deployment, `PEPPER`, or seed credentials.

## Required Separation

| Resource | Staging | Production |
|---|---|---|
| Google Sheet | staging test data | clean production copy |
| Apps Script project | staging script id | production script id |
| Web App URL | staging deployment | production deployment |
| Script Properties | staging values | production-only values |
| Frontend env | `.env.staging` | `.env.production` |

## Production Script Properties

Set these before running `setupSheets()` on the production Apps Script project:

```text
ENV=prod
SPREADSHEET_ID=<production-sheet-id>
PEPPER=<new-random-secret-not-used-in-staging>
ALERT_EMAIL=<owner-alert-email>
SEED_OWNER_PASSWORD=<new-production-password>
SEED_OWNER_PIN=<new-6-to-12-digit-pin>
SEED_OFFICE_PASSWORD=<new-production-password>
SEED_KASET_PASSWORD=<new-production-password>
SEED_THARUA_PASSWORD=<new-production-password>
SEED_BANJO_PASSWORD=<new-production-password>
```

Production seed passwords must be at least 12 characters. `SEED_OWNER_PIN` must be 6-12 digits. The bootstrap code rejects the demo credentials in `ENV=prod`.

## Split Steps

1. Create a new production Google Sheet from a blank spreadsheet.
2. Create or clone a separate production Apps Script project.
3. Set all production Script Properties above.
4. Run `setupSheets()` once.
5. Run `installNightlyTriggers()`.
6. Run `runAllTests()` in the Apps Script editor. It includes checks that production seed credentials reject demo values and accept strong values.
7. Deploy a production Web App version.
8. Copy `frontend/.env.production.example` to the local production env and set `VITE_GAS_URL` to the production Web App URL.
9. Copy `docs/production-script-properties.example` to `production.properties`, fill the real production Script Properties locally, and do not commit it.
10. After the restore drill, copy `docs/restore-drill.example.json` to `restore-drill.json`, fill real evidence IDs, and do not commit it.
11. After the production smoke test, copy `docs/production-smoke.example.json` to `production-smoke.json`, fill the real production Web App URL and checks, and do not commit it.
12. Run the local readiness check before go-live:

```bash
cd frontend
npm run check:prod
```

13. Run frontend verification against production URL with owner-approved test data only.
14. Change the initial production passwords/PIN again from the Admin UI after first login, then force logout all users.

## Hard Stops

Do not go live if any of these are true:

- production `ENV` is not `prod`
- any `SEED_*` property is missing
- any production seed password is still `owner1234`, `office1234`, or `staff1234`
- production owner PIN is still `246810`
- staging and production share the same `SPREADSHEET_ID`
- staging and production share the same Web App URL
- restore has never been tested and recorded in `restore-drill.json`
- production smoke has never been tested and recorded in `production-smoke.json`

The local readiness check covers all hard stops that can be represented as local evidence. The restore drill must be a real production-like Google Sheet backup/restore exercise before `restore-drill.json` is filled. The production smoke evidence must be collected against the production Web App URL from `.env.production`, not against staging.
