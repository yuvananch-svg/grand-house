var SHEETS = {
  Users: ["id", "user_id", "password_hash", "salt", "display_name", "role", "branch_id", "active", "approval_pin_hash", "failed_attempts", "locked_until", "pin_failed_attempts", "pin_locked_until"],
  Branches: ["branch_id", "branch_name", "active"],
  Products: ["id", "item_code", "name_th", "name_my", "image_url", "category", "source_type", "sell_price", "staff_price", "shelf_life_days", "is_perishable", "active", "image_data"],
  FinishedStock: ["lot_id", "branch_id", "product_id", "qty_in", "qty_remaining", "unit_cost", "received_date", "expiry_date", "source", "source_ref", "extend_count"],
  Sales: ["id", "branch_id", "user_id", "sale_type", "payment_method", "total_amount", "cash_received", "change_given", "total_cogs", "client_created_at", "server_received_at", "business_date", "synced_at", "reconcile_status", "status", "void_reason", "voided_by", "voided_at", "late_after_reconcile", "device_id"],
  SaleItems: ["id", "sale_id", "product_id", "qty", "unit_price", "is_freebie", "unit_cost", "lot_breakdown"],
  Wastage: ["id", "wastage_type", "branch_id", "user_id", "product_id", "material_id", "qty", "total_cost_value", "lot_breakdown", "created_at"],
  RawMaterials: ["id", "item_code", "name_th", "name_my", "warehouse", "base_unit", "display_unit", "display_factor", "is_packaging", "active"],
  SupplyItems: ["id", "item_code", "name_th", "name_my", "category", "unit", "active"],
  StockMovements: ["id", "date", "branch_id", "lot_id", "item_code", "type", "qty_change", "value_change", "ref_id"],
  RawLots: ["lot_id", "material_id", "branch_id", "qty_in", "qty_remaining", "unit_cost", "purchase_date", "supplier_note"],
  Recipes: ["id", "product_id", "name", "active"],
  RecipeItems: ["id", "recipe_id", "material_id", "qty_per_unit"],
  ProductionOrders: ["id", "branch_id", "user_id", "recipe_id", "qty_produced", "total_material_cost", "total_packaging_cost", "unit_cost_locked", "consumption_detail", "created_at", "output_lot_id"],
  GoodsReceipts: ["id", "branch_id", "user_id", "product_id", "qty", "unit_cost", "received_date"],
  StockAdjustments: ["id", "user_id", "approved_by", "target_type", "lot_id", "qty_before", "qty_after", "reason", "created_at"],
  Reconciliations: ["id", "branch_id", "business_date", "system", "actual", "diff_total", "status", "reconciled_by", "reconciled_at", "note"],
  Expenses: ["id", "branch_id", "user_id", "expense_type", "amount", "expense_month", "note", "created_at", "payment_channel", "purchase_qty", "item_code", "ref_id"],
  AuditLog: ["id", "timestamp", "user_id", "role", "branch_id", "action", "feature_group", "ref_id", "detail", "flag", "device_id", "success", "prev_hash", "row_hash"],
  Sessions: ["token_hash", "user_id", "role", "branch_id", "device_id", "expires_at", "revoked"],
  DailySummary: ["id", "branch_id", "business_date", "rev_normal", "rev_discount", "rev_freebie", "rev_staff", "pay_qr1", "pay_qr2", "pay_grab", "pay_cash", "pay_thai", "pay_other", "cogs_total", "wastage_value", "bill_count", "void_count", "last_rebuilt_at"],
  PriceHistory: ["id", "product_id", "field", "old_value", "new_value", "changed_by", "changed_at"],
  ErrorLog: ["id", "device_id", "user_id", "app_version", "message", "stack", "url", "created_at"],
  Devices: ["device_id", "label", "branch_id", "first_seen", "last_seen", "status"],
  Config: ["key", "value"]
};

function SheetDB_ss() {
  var id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!id) throw makeError("CONFIG_MISSING", "SPREADSHEET_ID is not set");
  return SpreadsheetApp.openById(id);
}

function SheetDB_setupSheets() {
  var ss = SheetDB_ss();
  Object.keys(SHEETS).forEach(function (name) {
    var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    var headers = SHEETS[name];
    var current = sheet.getRange(1, 1, 1, Math.max(headers.length, 1)).getValues()[0];
    if (current.slice(0, headers.length).join("|") !== headers.join("|")) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    sheet.setFrozenRows(1);
  });
}

function SheetDB_all(sheetName) {
  var sheet = SheetDB_ss().getSheetByName(sheetName);
  if (!sheet) throw makeError("SHEET_MISSING", sheetName);
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  var headers = values[0];
  return values.slice(1).filter(function (row) { return row.join("") !== ""; }).map(function (row, index) {
    var item = { _row: index + 2 };
    headers.forEach(function (header, col) { item[header] = row[col]; });
    return item;
  });
}

function SheetDB_insert(sheetName, row) {
  var sheet = SheetDB_ss().getSheetByName(sheetName);
  var headers = SHEETS[sheetName];
  sheet.appendRow(headers.map(function (header) { return sanitize(row[header], header); }));
}

function SheetDB_update(sheetName, keyName, keyValue, patch) {
  var sheet = SheetDB_ss().getSheetByName(sheetName);
  var headers = SHEETS[sheetName];
  var keyCol = headers.indexOf(keyName) + 1;
  if (keyCol <= 0) throw makeError("BAD_SCHEMA", "Missing key column: " + keyName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) throw makeError("NOT_FOUND", keyValue);
  var keyValues = sheet.getRange(2, keyCol, lastRow - 1, 1).getValues();
  var row = -1;
  for (var i = 0; i < keyValues.length; i++) {
    if (String(keyValues[i][0]) === String(keyValue)) {
      row = i + 2;
      break;
    }
  }
  if (row < 0) throw makeError("NOT_FOUND", keyValue);
  Object.keys(patch).forEach(function (key) {
    var col = headers.indexOf(key) + 1;
    if (col > 0) sheet.getRange(row, col).setValue(sanitize(patch[key], key));
  });
}

function SheetDB_findById(sheetName, keyName, keyValue) {
  return SheetDB_all(sheetName).filter(function (row) { return String(row[keyName]) === String(keyValue); })[0] || null;
}

function sanitize(value, key) {
  if (typeof value !== "string") return value;
  var limit = key === "image_data" ? 50000 : 1000;
  var trimmed = value.slice(0, limit);
  if (/^[=+\-@]/.test(trimmed)) return "'" + trimmed;
  return trimmed;
}

function newId(prefix) {
  return prefix + "-" + Math.floor(Date.now() / 1000) + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function nowIso() {
  return new Date().toISOString();
}

function businessDate() {
  return Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");
}

function businessDateFrom(sourceDate, config) {
  var date = sourceDate ? new Date(sourceDate) : new Date();
  if (isNaN(date.getTime())) date = new Date();
  var cutoffHour = Number((config || Config_get()).day_cutoff_hour || 0);
  var bangkokHour = Number(Utilities.formatDate(date, "Asia/Bangkok", "H"));
  if (cutoffHour > 0 && bangkokHour < cutoffHour) {
    date = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  }
  return Utilities.formatDate(date, "Asia/Bangkok", "yyyy-MM-dd");
}

function saleBusinessDate(clientCreatedAt, serverReceivedAt, config) {
  var clientDate = clientCreatedAt ? new Date(clientCreatedAt) : null;
  var serverDate = serverReceivedAt ? new Date(serverReceivedAt) : new Date();
  if (!clientDate || isNaN(clientDate.getTime())) return businessDateFrom(serverDate, config);
  var diffMinutes = Math.abs(serverDate.getTime() - clientDate.getTime()) / 60000;
  return businessDateFrom(diffMinutes < 10 ? serverDate : clientDate, config);
}

function hasClockDrift(clientCreatedAt, serverReceivedAt) {
  var clientDate = clientCreatedAt ? new Date(clientCreatedAt) : null;
  var serverDate = serverReceivedAt ? new Date(serverReceivedAt) : new Date();
  if (!clientDate || isNaN(clientDate.getTime())) return false;
  return Math.abs(serverDate.getTime() - clientDate.getTime()) > 48 * 60 * 60 * 1000;
}
