#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const demoValues = new Map([
  ["SEED_OWNER_PASSWORD", "owner1234"],
  ["SEED_OWNER_PIN", "246810"],
  ["SEED_OFFICE_PASSWORD", "office1234"],
  ["SEED_KASET_PASSWORD", "staff1234"],
  ["SEED_THARUA_PASSWORD", "staff1234"],
  ["SEED_BANJO_PASSWORD", "staff1234"]
]);

const requiredProdProps = [
  "ENV",
  "SPREADSHEET_ID",
  "PEPPER",
  "ALERT_EMAIL",
  "SEED_OWNER_PASSWORD",
  "SEED_OWNER_PIN",
  "SEED_OFFICE_PASSWORD",
  "SEED_KASET_PASSWORD",
  "SEED_THARUA_PASSWORD",
  "SEED_BANJO_PASSWORD"
];

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) throw new Error(`Unknown argument: ${arg}`);
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    args[key] = value;
    i += 1;
  }
  return args;
}

function readJsonFile(filePath) {
  const absolute = path.resolve(filePath);
  return JSON.parse(fs.readFileSync(absolute, "utf8"));
}

function readKeyValueFile(filePath) {
  const absolute = path.resolve(filePath);
  const text = fs.readFileSync(absolute, "utf8");
  const values = {};
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!match) return;
    const [, key, rawValue] = match;
    values[key] = rawValue.replace(/^["']|["']$/g, "").trim();
  });
  return values;
}

function isPlaceholder(value) {
  return !value || /<[^>]+>/.test(value) || /\bTODO\b/i.test(value) || /\bCHANGE_ME\b/i.test(value);
}

function checkProdEnv(values, errors) {
  if (values.VITE_API_MODE !== "gas") errors.push("frontend env: VITE_API_MODE must be gas");
  if (isPlaceholder(values.VITE_GAS_URL)) errors.push("frontend env: VITE_GAS_URL is missing or still a placeholder");
  if (values.VITE_GAS_URL && !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(values.VITE_GAS_URL)) {
    errors.push("frontend env: VITE_GAS_URL must be a deployed Apps Script Web App /exec URL");
  }
}

function checkProdProps(values, errors) {
  requiredProdProps.forEach((key) => {
    if (isPlaceholder(values[key])) errors.push(`script properties: ${key} is missing or still a placeholder`);
  });
  if (values.ENV !== "prod") errors.push("script properties: ENV must be prod");
  if (values.PEPPER && values.PEPPER.length < 32) errors.push("script properties: PEPPER must be at least 32 characters");
  if (values.ALERT_EMAIL && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.ALERT_EMAIL)) {
    errors.push("script properties: ALERT_EMAIL must look like an email address");
  }
  for (const [key, demo] of demoValues) {
    if (values[key] === demo) errors.push(`script properties: ${key} still uses the demo value`);
  }
  for (const key of demoValues.keys()) {
    const value = values[key] || "";
    if (key === "SEED_OWNER_PIN") {
      if (!/^\d{6,12}$/.test(value)) errors.push("script properties: SEED_OWNER_PIN must be 6-12 digits");
    } else if (value.length > 0 && value.length < 12) {
      errors.push(`script properties: ${key} must be at least 12 characters`);
    }
  }
}

function checkSeparation(prodEnv, prodProps, args, errors) {
  if (args["staging-env"]) {
    const stagingEnv = readKeyValueFile(args["staging-env"]);
    if (stagingEnv.VITE_GAS_URL && stagingEnv.VITE_GAS_URL === prodEnv.VITE_GAS_URL) {
      errors.push("separation: production and staging VITE_GAS_URL are identical");
    }
  }
  if (args["staging-properties"]) {
    const stagingProps = readKeyValueFile(args["staging-properties"]);
    if (stagingProps.SPREADSHEET_ID && stagingProps.SPREADSHEET_ID === prodProps.SPREADSHEET_ID) {
      errors.push("separation: production and staging SPREADSHEET_ID are identical");
    }
    if (stagingProps.PEPPER && stagingProps.PEPPER === prodProps.PEPPER) {
      errors.push("separation: production and staging PEPPER are identical");
    }
  }
}

function checkRestoreDrill(args, errors) {
  if (!args["restore-drill"]) {
    errors.push("restore drill: pass --restore-drill <evidence.json> after completing a real restore drill");
    return;
  }
  let evidence;
  try {
    evidence = readJsonFile(args["restore-drill"]);
  } catch (error) {
    errors.push("restore drill: evidence file must be readable JSON");
    return;
  }
  if (evidence.completed !== true) errors.push("restore drill: completed must be true");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(evidence.date || ""))) errors.push("restore drill: date must be YYYY-MM-DD");
  if (isPlaceholder(evidence.backup_spreadsheet_id)) errors.push("restore drill: backup_spreadsheet_id is missing or placeholder");
  if (isPlaceholder(evidence.restored_spreadsheet_id)) errors.push("restore drill: restored_spreadsheet_id is missing or placeholder");
  if (evidence.backup_spreadsheet_id && evidence.backup_spreadsheet_id === evidence.restored_spreadsheet_id) {
    errors.push("restore drill: backup and restored spreadsheet ids must differ");
  }
  if (evidence.owner_approved !== true) errors.push("restore drill: owner_approved must be true");
  if (evidence.smoke_passed !== true) errors.push("restore drill: smoke_passed must be true");
  if (evidence.outbox_checked !== true) errors.push("restore drill: outbox_checked must be true");
}

function checkProductionSmoke(args, prodEnv, errors) {
  if (!args["production-smoke"]) {
    errors.push("production smoke: pass --production-smoke <evidence.json> after completing production smoke tests");
    return;
  }
  let evidence;
  try {
    evidence = readJsonFile(args["production-smoke"]);
  } catch (error) {
    errors.push("production smoke: evidence file must be readable JSON");
    return;
  }

  if (evidence.completed !== true) errors.push("production smoke: completed must be true");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(evidence.date || ""))) errors.push("production smoke: date must be YYYY-MM-DD");
  if (isPlaceholder(evidence.web_app_url)) errors.push("production smoke: web_app_url is missing or placeholder");
  if (evidence.web_app_url && !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(evidence.web_app_url)) {
    errors.push("production smoke: web_app_url must be a deployed Apps Script Web App /exec URL");
  }
  if (evidence.web_app_url && prodEnv.VITE_GAS_URL && evidence.web_app_url !== prodEnv.VITE_GAS_URL) {
    errors.push("production smoke: web_app_url must match frontend env VITE_GAS_URL");
  }

  [
    "owner_login",
    "staff_login",
    "sale_created",
    "sale_voided",
    "wastage_created",
    "reconcile_completed",
    "dashboard_checked",
    "run_all_tests_passed",
    "owner_approved"
  ].forEach((key) => {
    if (evidence[key] !== true) errors.push(`production smoke: ${key} must be true`);
  });
}

function main() {
  const args = parseArgs(process.argv);
  if (!args["frontend-env"] || !args["script-properties"]) {
    throw new Error("Usage: node scripts/check-production-readiness.mjs --frontend-env <file> --script-properties <file> --restore-drill <evidence.json> --production-smoke <evidence.json> [--staging-env <file>] [--staging-properties <file>]");
  }

  const prodEnv = readKeyValueFile(args["frontend-env"]);
  const prodProps = readKeyValueFile(args["script-properties"]);
  const errors = [];

  checkProdEnv(prodEnv, errors);
  checkProdProps(prodProps, errors);
  checkSeparation(prodEnv, prodProps, args, errors);
  checkRestoreDrill(args, errors);
  checkProductionSmoke(args, prodEnv, errors);

  if (errors.length) {
    console.error("Production readiness check failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log("Production readiness check passed.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
