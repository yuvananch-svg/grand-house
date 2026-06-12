/**
 * Google Apps Script Web App entrypoint.
 * Contract: HTTP 200 always, body decides success/error because GAS cannot handle CORS OPTIONS.
 * Frontend must send JSON string with Content-Type: text/plain;charset=utf-8.
 */
var ROLE_ACTIONS = {
  staff: ["app.snapshot", "product.list", "product.images", "stock.myBranch", "sale.syncBatch", "sale.void", "wastage.create", "stock.extendExpiry", "log.clientError"],
  office: [
    "app.snapshot",
    "product.list",
    "product.images",
    "item.list",
    "sale.void",
    "goods.receive",
    "rawlot.purchase",
    "inventory.list",
    "production.preview",
    "production.run",
    "recipe.list",
    "stockAdjust.request",
    "reconcile.getDaily",
    "reconcile.confirm",
    "expense.create",
    "expense.list",
    "rawWastage.create",
    "log.clientError"
  ],
  owner: ["*"]
};

function doGet() {
  return jsonOk({ service: "grands-house-gas", status: "ready" });
}

function doPost(e) {
  var req;
  var body = e.postData && e.postData.contents ? e.postData.contents : "{}";
  if (body.length > 200 * 1024) return jsonError("PAYLOAD_TOO_LARGE", "Request body exceeds 200KB");
  try {
    req = JSON.parse(body);
  } catch (error) {
    return jsonError("BAD_JSON", "Invalid JSON body");
  }

  if (!req.action) return jsonError("BAD_REQUEST", "Missing action");

  try {
    Auth_enforceRateLimit(req.device_id || "UNKNOWN", req.token || "");
    if (req.action === "login") {
      var loginLock = LockService.getScriptLock();
      loginLock.waitLock(30000);
      GH_WRITE_LOCK_HELD = true;
      try {
        return jsonOk(Auth_login(req.payload || {}, req.device_id || "UNKNOWN"));
      } finally {
        GH_WRITE_LOCK_HELD = false;
        loginLock.releaseLock();
      }
    }

    var session = Auth_verifyToken(req.token, req.device_id || "UNKNOWN");
    if (!session) {
      Audit_log(null, "INVALID_TOKEN", req.action, {}, false, "SUSPICIOUS", req.device_id || "UNKNOWN");
      return jsonError("AUTH_EXPIRED", "Session expired");
    }
    if (!isAllowed(session.role, req.action)) {
      Audit_log(session, "FORBIDDEN_ATTEMPT", req.action, {}, false, "SUSPICIOUS", req.device_id || "UNKNOWN");
      return jsonError("FORBIDDEN", "Forbidden");
    }

    req.payload = req.payload || {};
    if (session.role === "staff") req.payload.branch_id = session.branch_id;

    var lock = LockService.getScriptLock();
    var needsLock = isWriteAction(req.action);
    if (needsLock) {
      lock.waitLock(30000);
      GH_WRITE_LOCK_HELD = true;
    }
    try {
      return jsonOk(routeAction(req.action, req.payload, session, req.device_id || "UNKNOWN"));
    } finally {
      if (needsLock) {
        GH_WRITE_LOCK_HELD = false;
        lock.releaseLock();
      }
    }
  } catch (error) {
    return jsonError(error.code || "SERVER_ERROR", error.message || String(error));
  }
}

function routeAction(action, payload, session, deviceId) {
  switch (action) {
    case "app.snapshot":
      return App_snapshot(payload, session);
    case "product.list":
      return Inventory_productList();
    case "product.images":
      return Inventory_productImages(session);
    case "item.list":
      return Items_list();
    case "item.save":
      return Items_save(payload, session, deviceId);
    case "stock.myBranch":
      return Inventory_stockMyBranch(session.branch_id);
    case "sale.syncBatch":
      return Sales_syncBatch(payload, session, deviceId);
    case "sale.void":
      return Sales_void(payload, session, deviceId);
    case "wastage.create":
      return Wastage_create(payload, session, deviceId);
    case "rawWastage.create":
      return Wastage_createRaw(payload, session, deviceId);
    case "stock.extendExpiry":
      return Inventory_extendExpiry(payload, session, deviceId);
    case "goods.receive":
      return Inventory_goodsReceive(payload, session, deviceId);
    case "rawlot.purchase":
      return Inventory_rawLotPurchase(payload, session, deviceId);
    case "inventory.list":
      return Inventory_list(payload, session);
    case "production.preview":
      return Production_preview(payload, session);
    case "production.run":
      return Production_run(payload, session, deviceId);
    case "stockAdjust.request":
      return Inventory_stockAdjust(payload, session, deviceId);
    case "reconcile.getDaily":
      return Reconcile_getDaily(payload, session);
    case "reconcile.confirm":
      return Reconcile_confirm(payload, session, deviceId);
    case "expense.create":
      return Expenses_create(payload, session, deviceId);
    case "expense.list":
      return Expenses_list(payload, session);
    case "recipe.save":
      return Production_recipeSave(payload, session, deviceId);
    case "recipe.list":
      return Production_recipeList();
    case "report.summary":
      return Reports_summary(payload, session);
    case "report.financialStatement":
      return Reports_financialStatement(payload, session);
    case "audit.query":
      return Audit_query(payload, session);
    case "user.manage":
      return Auth_userManage(payload, session, deviceId);
    case "log.clientError":
      return Audit_clientError(payload, session, deviceId);
    case "maintenance.installTriggers": {
      var triggerResult = installNightlyTriggers();
      Audit_log(session, "INSTALL_TRIGGERS", "nightly", triggerResult, true, "", deviceId);
      return triggerResult;
    }
    case "maintenance.triggerStatus":
      return nightlyTriggerStatus();
    case "maintenance.runTests":
      return { summary: runAllTests() };
    default:
      throw makeError("NOT_IMPLEMENTED", "Action not implemented: " + action);
  }
}

function isAllowed(role, action) {
  var allowed = ROLE_ACTIONS[role] || [];
  return allowed.indexOf("*") >= 0 || allowed.indexOf(action) >= 0;
}

function isWriteAction(action) {
  return action !== "product.list" &&
    action !== "product.images" &&
    action !== "item.list" &&
    action !== "app.snapshot" &&
    action !== "stock.myBranch" &&
    action !== "inventory.list" &&
    action !== "production.preview" &&
    action !== "reconcile.getDaily" &&
    action !== "expense.list" &&
    action !== "recipe.list" &&
    action !== "report.summary" &&
    action !== "report.financialStatement" &&
    action !== "audit.query" &&
    action !== "maintenance.triggerStatus" &&
    action !== "maintenance.runTests";
}

function jsonOk(data) {
  var body = { ok: true, data: data };
  try {
    var config = Config_get();
    if (config.catalog_version) body.catalog_version = Number(config.catalog_version);
  } catch (error) {
    // Health checks can run before SPREADSHEET_ID is configured.
  }
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

function jsonError(code, message) {
  return ContentService.createTextOutput(JSON.stringify({ ok: false, code: code, message: message })).setMimeType(ContentService.MimeType.JSON);
}

function makeError(code, message) {
  var error = new Error(message);
  error.code = code;
  return error;
}
