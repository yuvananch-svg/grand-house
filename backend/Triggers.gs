var NIGHTLY_TRIGGER_FUNCTIONS = [
  "yearlyArchivePreviousYear",
  "nightlyRebuildDailySummary",
  "nightlyVerifyAuditChain",
  "nightlyBackupSpreadsheet",
  "nightlyPruneSessions",
  "morningHealthReport"
];

function installNightlyTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (NIGHTLY_TRIGGER_FUNCTIONS.indexOf(trigger.getHandlerFunction()) >= 0) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger("yearlyArchivePreviousYear").timeBased().everyDays(1).atHour(1).create();
  ScriptApp.newTrigger("nightlyRebuildDailySummary").timeBased().everyDays(1).atHour(2).create();
  ScriptApp.newTrigger("nightlyVerifyAuditChain").timeBased().everyDays(1).atHour(3).create();
  ScriptApp.newTrigger("nightlyBackupSpreadsheet").timeBased().everyDays(1).atHour(4).create();
  ScriptApp.newTrigger("nightlyPruneSessions").timeBased().everyDays(1).atHour(5).create();
  ScriptApp.newTrigger("morningHealthReport").timeBased().everyDays(1).atHour(7).create();
  return nightlyTriggerStatus();
}

function nightlyTriggerStatus() {
  var installed = ScriptApp.getProjectTriggers()
    .map(function (trigger) { return trigger.getHandlerFunction(); })
    .filter(function (handler) { return NIGHTLY_TRIGGER_FUNCTIONS.indexOf(handler) >= 0; });
  return {
    expected: NIGHTLY_TRIGGER_FUNCTIONS,
    installed: installed,
    missing: NIGHTLY_TRIGGER_FUNCTIONS.filter(function (handler) {
      return installed.indexOf(handler) < 0;
    })
  };
}

// GAP-06/M10': rebuild only yesterday's rows, not the entire history (avoids the 6-minute quota as data grows).
function nightlyRebuildDailySummary() {
  var config = Config_get();
  var yesterday = businessDateFrom(new Date(Date.now() - 24 * 60 * 60 * 1000), config);
  deleteRowsWhere("DailySummary", function (row) { return String(row.business_date) === yesterday; });
  SheetDB_all("Sales").filter(function (sale) {
    return sale.status === "active" && sale.business_date === yesterday;
  }).forEach(function (sale) {
    DailySummary_addSale(sale);
  });
  var voidCounts = {};
  SheetDB_all("Sales").filter(function (sale) {
    return sale.status === "voided" && sale.business_date === yesterday;
  }).forEach(function (sale) {
    voidCounts[sale.branch_id] = Number(voidCounts[sale.branch_id] || 0) + 1;
  });
  Object.keys(voidCounts).forEach(function (branchId) {
    DailySummary_addVoidCount(branchId, yesterday, voidCounts[branchId]);
  });
  SheetDB_all("Wastage").filter(function (row) {
    return businessDateFrom(row.created_at, config) === yesterday;
  }).forEach(function (row) {
    DailySummary_addWastage(row.branch_id, yesterday, row.total_cost_value);
  });
}

function yearlyArchivePreviousYear() {
  var today = businessDate();
  if (today.slice(5) !== "01-01") return { skipped: true, reason: "not_jan_1", date: today };
  var year = String(Number(today.slice(0, 4)) - 1);
  return archiveYear(year);
}

function archiveYear(year) {
  if (!/^\d{4}$/.test(String(year))) throw makeError("BAD_ARCHIVE_YEAR", "Archive year must be YYYY");
  var archive = archiveSpreadsheet(year);
  var saleIds = {};
  var counts = {
    Sales: archiveRowsByPredicate("Sales", archive, function (row) {
      var match = String(row.business_date || "").slice(0, 4) === String(year);
      if (match) saleIds[row.id] = true;
      return match;
    }),
    SaleItems: 0,
    AuditLog: archiveRowsByPredicate("AuditLog", archive, function (row) {
      return String(row.timestamp || "").slice(0, 4) === String(year);
    })
  };
  counts.SaleItems = archiveRowsByPredicate("SaleItems", archive, function (row) {
    return saleIds[row.sale_id] === true;
  });
  return { year: year, counts: counts, archive_url: archive.getUrl() };
}

function archiveSpreadsheet(year) {
  var name = "GrandHouse_Archive_" + year;
  var folder = backupFolder();
  var files = folder.getFilesByName(name);
  var ss = files.hasNext() ? SpreadsheetApp.openById(files.next().getId()) : SpreadsheetApp.create(name);
  var file = DriveApp.getFileById(ss.getId());
  try {
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
  } catch (error) {
    /* File may already be in the backup folder or root removal may be unavailable. */
  }
  ["Sales", "SaleItems", "AuditLog"].forEach(function (sheetName) {
    archiveEnsureSheet(ss, sheetName);
  });
  return ss;
}

function archiveEnsureSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  var headers = SHEETS[sheetName];
  if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() === "") {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function archiveRowsByPredicate(sheetName, archive, predicate) {
  var source = SheetDB_ss().getSheetByName(sheetName);
  var rows = SheetDB_all(sheetName).filter(predicate);
  if (!rows.length) return 0;
  var headers = SHEETS[sheetName];
  var target = archiveEnsureSheet(archive, sheetName);
  var values = rows.map(function (row) {
    return headers.map(function (header) { return row[header] === undefined ? "" : row[header]; });
  });
  target.getRange(target.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
  rows.slice().reverse().forEach(function (row) {
    source.deleteRow(row._row);
  });
  return rows.length;
}

function nightlyVerifyAuditChain() {
  try {
    verifyAuditChain();
  } catch (error) {
    notifyAlert("Grand's House audit chain failed", error.message || String(error));
    throw error;
  }
}

function nightlyBackupSpreadsheet() {
  var id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!id) throw makeError("CONFIG_MISSING", "SPREADSHEET_ID is not set");
  var folder = backupFolder();
  var source = DriveApp.getFileById(id);
  var now = new Date();
  var stamp = Utilities.formatDate(now, "Asia/Bangkok", "yyyy-MM-dd HH:mm");
  source.makeCopy("GrandHouse Daily Backup " + stamp, folder);
  if (Utilities.formatDate(now, "Asia/Bangkok", "EEE") === "Sun") {
    source.makeCopy("GrandHouse Weekly Backup " + stamp, folder);
  }
  // GAP-22: keep 30 days of daily backups, prune older copies
  var dailyCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  var weeklyCutoff = Date.now() - 12 * 7 * 24 * 60 * 60 * 1000;
  var files = folder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    var name = file.getName();
    var created = file.getDateCreated().getTime();
    if (name.indexOf("GrandHouse Weekly Backup ") === 0 && created < weeklyCutoff) file.setTrashed(true);
    if (name.indexOf("GrandHouse Daily Backup ") === 0 && created < dailyCutoff) file.setTrashed(true);
    if (name.indexOf("GrandHouse Backup ") === 0 && created < dailyCutoff) file.setTrashed(true);
  }
}

function backupFolder() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty("BACKUP_FOLDER_ID");
  if (folderId) {
    try { return DriveApp.getFolderById(folderId); } catch (error) { /* recreate below */ }
  }
  var folder = DriveApp.createFolder("GrandHouse Backups");
  props.setProperty("BACKUP_FOLDER_ID", folder.getId());
  return folder;
}

function nightlyPruneSessions() {
  deleteRowsWhere("Sessions", function (row) {
    return String(row.revoked).toUpperCase() === "TRUE" || new Date(row.expires_at) <= new Date();
  });
}

function morningHealthReport() {
  var config = Config_get();
  var yesterday = businessDateFrom(new Date(Date.now() - 24 * 60 * 60 * 1000), config);
  var yRevenue = SheetDB_all("DailySummary").filter(function (row) { return String(row.business_date) === yesterday; })
    .reduce(function (sum, row) { return sum + Number(row.rev_normal || 0) + Number(row.rev_discount || 0) + Number(row.rev_freebie || 0) + Number(row.rev_staff || 0); }, 0);
  var suspicious = healthSuspiciousSummary(yesterday, config);
  var deadOutbox = SheetDB_all("ErrorLog").filter(function (row) {
    return businessDateFrom(row.created_at, config) === yesterday && String(row.message || "").indexOf("DEAD_OUTBOX") === 0;
  }).length;
  var pendingRecon = SheetDB_all("Reconciliations").filter(function (row) {
    return row.status === "mismatch" || row.status === "reopened" || row.status === "pending";
  }).length;
  var message = [
    "Generated: " + nowIso(),
    "Yesterday (" + yesterday + ") revenue: " + (yRevenue / 100).toFixed(2) + " THB",
    "Suspicious audit flags yesterday: " + suspicious.count + " / value: " + (suspicious.value / 100).toFixed(2) + " THB",
    "Dead outbox reports yesterday: " + deadOutbox,
    "Reconciliations needing attention: " + pendingRecon,
    "Sales rows: " + SheetDB_all("Sales").length,
    "Pending sessions: " + SheetDB_all("Sessions").filter(function (row) {
      return String(row.revoked).toUpperCase() !== "TRUE" && new Date(row.expires_at) > new Date();
    }).length,
    "Audit rows: " + SheetDB_all("AuditLog").length,
    "Client errors: " + SheetDB_all("ErrorLog").length
  ].join("\n");
  notifyAlert("Grand's House daily health report", message);
  return message;
}

function healthSuspiciousSummary(businessDateValue, config) {
  var count = 0;
  var value = 0;
  SheetDB_all("AuditLog").forEach(function (row) {
    if (businessDateFrom(row.timestamp, config) !== businessDateValue) return;
    if (String(row.flag || "").split(",").indexOf("SUSPICIOUS") < 0) return;
    count += 1;
    value += healthValueFromAuditRow(row);
  });
  return { count: count, value: value };
}

function healthValueFromAuditRow(row) {
  var detail = {};
  try { detail = JSON.parse(row.detail || "{}"); } catch (error) { detail = {}; }
  if (detail.total_amount !== undefined) return Number(detail.total_amount || 0);
  if (detail.total_cost_value !== undefined) return Number(detail.total_cost_value || 0);
  if (detail.amount !== undefined) return Number(detail.amount || 0);
  var sale = SheetDB_findById("Sales", "id", row.ref_id);
  if (sale) return Number(sale.total_amount || 0);
  var wastage = SheetDB_findById("Wastage", "id", row.ref_id);
  if (wastage) return Number(wastage.total_cost_value || 0);
  return 0;
}

function clearSheetRows(sheetName) {
  var sheet = SheetDB_ss().getSheetByName(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);
}

function deleteRowsWhere(sheetName, predicate) {
  var sheet = SheetDB_ss().getSheetByName(sheetName);
  SheetDB_all(sheetName).reverse().forEach(function (row) {
    if (predicate(row)) sheet.deleteRow(row._row);
  });
}

function notifyAlert(subject, body) {
  var email = PropertiesService.getScriptProperties().getProperty("ALERT_EMAIL");
  if (email) MailApp.sendEmail(email, subject, body);
}
