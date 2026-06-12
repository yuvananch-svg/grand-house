# Restore Runbook Draft

The staging GAS deployment has `SPREADSHEET_ID` set and nightly triggers installed. Backups are created by `nightlyBackupSpreadsheet()` at 04:00 Asia/Bangkok.

## Backup Policy

- Daily: copy the whole Grand's House spreadsheet via `nightlyBackupSpreadsheet()`.
- Weekly: every Sunday, create an additional weekly copy.
- Keep daily backups for 30 days and weekly backups for 12 weeks.
- Yearly archive: on January 1, `yearlyArchivePreviousYear()` moves prior-year `Sales`, linked `SaleItems`, and `AuditLog` rows to `GrandHouse_Archive_<year>` in the backup folder. Long-range reporting still uses `DailySummary` in the live spreadsheet.
- Health report should include the latest backup status.

## Restore Flow

1. Stop production writes by disabling the GAS deployment or temporarily blocking staff devices.
2. Locate the latest valid backup spreadsheet. For bill-level data from a prior year, also locate `GrandHouse_Archive_<year>`.
3. Rename or copy it as the new production DB.
4. Update GAS Script Property `SPREADSHEET_ID` to the restored spreadsheet.
5. Run a smoke check only after owner approval.
6. Re-enable staff devices.
7. Compare outbox state on branch tablets for unsynced sales after the backup timestamp.
8. Record the evidence in `restore-drill.json` using `docs/restore-drill.example.json` as the template. Do not commit the real evidence file.

## Important Note

Backup that has never been restored is not a backup. A restore drill must be part of the later staging/go-live phase.
