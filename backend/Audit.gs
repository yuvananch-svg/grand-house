var GH_WRITE_LOCK_HELD = false;

function Audit_log(session, action, refId, detail, success, flag, deviceId) {
  var auditLock = null;
  if (!GH_WRITE_LOCK_HELD) {
    auditLock = LockService.getScriptLock();
    auditLock.waitLock(30000);
  }
  var props = PropertiesService.getScriptProperties();
  try {
    var prev = props.getProperty("AUDIT_LAST_HASH");
    if (!prev) {
      var rows = SheetDB_all("AuditLog");
      prev = rows.length ? rows[rows.length - 1].row_hash : "GENESIS";
    }
    var row = {
      id: newId("AUD"),
      timestamp: nowIso(),
      user_id: session ? session.user_id : "anonymous",
      role: session ? session.role : "anonymous",
      branch_id: session ? session.branch_id : "ALL",
      action: action,
      feature_group: featureGroup(action),
      ref_id: refId,
      detail: JSON.stringify(detail || {}),
      flag: flag || "",
      device_id: deviceId || "UNKNOWN",
      success: success === true,
      prev_hash: prev,
      row_hash: ""
    };
    row.row_hash = auditHash(row.prev_hash + row.timestamp + row.user_id + row.action + row.ref_id + row.detail);
    SheetDB_insert("AuditLog", row);
    props.setProperty("AUDIT_LAST_HASH", row.row_hash);
    return row;
  } finally {
    if (auditLock) auditLock.releaseLock();
  }
}

function Audit_query(payload) {
  return SheetDB_all("AuditLog").filter(function (row) {
    return (!payload.feature_group || row.feature_group === payload.feature_group) &&
      (!payload.branch_id || payload.branch_id === "ALL" || row.branch_id === payload.branch_id) &&
      (!payload.flag || String(row.flag || "").split(",").indexOf(payload.flag) >= 0);
  });
}

function Audit_clientError(payload, session, deviceId) {
  var today = businessDate();
  var cache = CacheService.getScriptCache();
  var key = "err:" + String(deviceId || "UNKNOWN").slice(0, 80) + ":" + today;
  var count = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(count), 24 * 60 * 60);
  if (count > 20) throw makeError("ERROR_LOG_RATE_LIMITED", "Too many client errors today");
  var row = {
    id: newId("ERR"),
    device_id: deviceId,
    user_id: session.user_id,
    app_version: payload.app_version || "unknown",
    message: String(payload.message || "").slice(0, 300),
    stack: String(payload.stack || "").slice(0, 1000),
    url: payload.url || "",
    created_at: nowIso()
  };
  SheetDB_insert("ErrorLog", row);
  return row;
}

function verifyAuditChain() {
  var rows = SheetDB_all("AuditLog");
  var prev = rows.length ? rows[0].prev_hash : "GENESIS";
  for (var i = 0; i < rows.length; i++) {
    if (i > 0 && rows[i].prev_hash !== prev) {
      throw makeError("AUDIT_CHAIN_BROKEN", "Audit chain prev_hash broken at sheet row " + rows[i]._row);
    }
    var expected = auditHash(prev + rows[i].timestamp + rows[i].user_id + rows[i].action + rows[i].ref_id + rows[i].detail);
    if (rows[i].row_hash !== expected) {
      throw makeError("AUDIT_CHAIN_BROKEN", "Audit chain broken at sheet row " + rows[i]._row);
    }
    prev = rows[i].row_hash;
  }
  PropertiesService.getScriptProperties().setProperty("AUDIT_LAST_HASH", prev);
  return true;
}

function auditHash(input) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input).map(function (b) {
    return ("0" + (b & 0xff).toString(16)).slice(-2);
  }).join("");
}

function featureGroup(action) {
  if (String(action).indexOf("SALE") === 0) return "pos";
  if (String(action).indexOf("WASTAGE") >= 0 || String(action).indexOf("EXPIRY") >= 0) return "wastage";
  if (String(action).indexOf("GOODS") === 0 || String(action).indexOf("RAWLOT") === 0 || String(action).indexOf("STOCK") === 0) return "inventory";
  if (String(action).indexOf("PRODUCTION") === 0 || String(action).indexOf("RECIPE") === 0) return "production";
  if (String(action).indexOf("RECONCILE") === 0) return "reconcile";
  if (String(action).indexOf("EXPENSE") === 0) return "expense";
  if (String(action).indexOf("LOGIN") === 0 || String(action).indexOf("TOKEN") >= 0) return "auth";
  if (String(action).indexOf("REPORT") === 0) return "report";
  return "admin";
}
