#!/usr/bin/env bash
# Push backend to the target GAS environment.
# Usage: ./scripts/gas-push.sh staging | prod
set -euo pipefail

ENV="${1:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLASP_STAGING="$ROOT/.clasp.staging.json"
CLASP_PROD="$ROOT/.clasp.json"

if [[ "$ENV" == "staging" ]]; then
  if grep -q '<STAGING_SCRIPT_ID>' "$CLASP_STAGING"; then
    echo "ERROR: Replace <STAGING_SCRIPT_ID> in .clasp.staging.json with the real staging script ID first." >&2
    exit 1
  fi
  cp "$CLASP_STAGING" "$ROOT/.clasp.json"
  echo "Pushing to STAGING ($(jq -r .scriptId "$ROOT/.clasp.json"))…"
  cd "$ROOT" && npx @google/clasp push
  echo "Staging push complete."

elif [[ "$ENV" == "prod" ]]; then
  echo "ERROR: Never push directly to production from a script." >&2
  echo "Instead:" >&2
  echo "  1. Verify staging is working." >&2
  echo "  2. Create a new versioned deployment in the production Apps Script editor." >&2
  echo "  3. Run: npm run check:prod  (from frontend/)" >&2
  exit 1

else
  echo "Usage: $0 staging | prod" >&2
  exit 1
fi
