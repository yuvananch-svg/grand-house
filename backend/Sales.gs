function Sales_syncBatch(payload, session, deviceId) {
  var sales = payload.sales || [];
  Sales_validateBatchSize(sales);
  return {
    results: sales.map(function (sale) {
      try {
        return Sales_processOne(sale, session, deviceId);
      } catch (error) {
        Audit_log(session, "SALE_REJECTED", sale.id || "unknown", { code: error.code || "SERVER_ERROR", message: error.message || String(error) }, false, "SUSPICIOUS", deviceId);
        return { id: sale.id || "", status: "rejected", code: error.code || "SERVER_ERROR", message: error.message || String(error) };
      }
    }),
    stock: Inventory_stockMyBranch(session.branch_id)
  };
}

function Sales_validateBatchSize(sales) {
  if (sales.length > 50) throw makeError("BATCH_TOO_LARGE", "sale.syncBatch accepts at most 50 sales");
  sales.forEach(function (sale) {
    if ((sale.items || []).length > 100) throw makeError("BATCH_TOO_LARGE", "Each sale accepts at most 100 items");
  });
}

function Sales_processOne(draft, session, deviceId) {
  if (Sales_exists(draft.id)) return { id: draft.id, status: "duplicate" };
  if (!draft.id || !(draft.items || []).length) throw makeError("BAD_REQUEST", "Sale requires id and items");
  if (["normal", "discount", "freebie", "staff"].indexOf(String(draft.sale_type)) < 0) throw makeError("BAD_SALE_TYPE", "Invalid sale type");
  if (["QR1", "QR2", "GRAB", "CASH", "THAI_HELP_THAI", "OTHER"].indexOf(String(draft.payment_method)) < 0) throw makeError("BAD_PAYMENT", "Invalid payment method");
  if (!Sales_isInt(Number(draft.total_amount)) || Number(draft.total_amount) < 0) throw makeError("BAD_TOTAL", "Invalid total amount");
  if (!Sales_isInt(Number(draft.cash_received || 0)) || !Sales_isInt(Number(draft.change_given || 0)) || Number(draft.cash_received || 0) < 0 || Number(draft.change_given || 0) < 0) throw makeError("BAD_CASH", "Invalid cash fields");

  var branchId = session.role === "staff" ? session.branch_id : draft.branch_id;
  var serverReceivedAt = nowIso();
  var config = Config_get();
  var rowBusinessDate = saleBusinessDate(draft.client_created_at, serverReceivedAt, config);
  var serverBusinessDate = businessDateFrom(serverReceivedAt, config);
  var isLateAfterReconcile = rowBusinessDate < serverBusinessDate && Sales_reopenReconciliationIfNeeded(branchId, rowBusinessDate);
  var totalCogs = 0;
  var flag = "";
  if (hasClockDrift(draft.client_created_at, serverReceivedAt)) flag = Sales_addFlag(flag, "CLOCK_DRIFT");
  if (isLateAfterReconcile) flag = Sales_addFlag(flag, "LATE_SYNC");
  // SUSPICIOUS rule: staff buying too frequently in one day (Grand's 7.4)
  if (draft.sale_type === "staff") {
    var staffSalesToday = SheetDB_all("Sales").filter(function (s) {
      return s.sale_type === "staff" && s.user_id === session.user_id && s.business_date === rowBusinessDate && s.status === "active";
    }).length;
    if (staffSalesToday + 1 > Number(config.suspicious_staffsale_per_day || 5)) flag = Sales_addFlag(flag, "SUSPICIOUS");
  }
  var products = SheetDB_all("Products");
  var productsById = products.reduce(function (acc, product) {
    acc[product.id] = product;
    return acc;
  }, {});
  (draft.items || []).forEach(function (item) {
    if (!productsById[item.product_id]) throw makeError("BAD_PRODUCT", "Unknown product: " + item.product_id);
    if (!Sales_isInt(Number(item.qty)) || !Sales_isInt(Number(item.unit_price)) || Number(item.qty) <= 0 || Number(item.unit_price) < 0) throw makeError("BAD_ITEM", "Invalid sale item: " + item.product_id);
  });
  var serverTotal = (draft.items || []).reduce(function (sum, item) {
    return sum + Number(item.qty) * Number(item.unit_price);
  }, 0);
  if (Number(draft.total_amount) !== serverTotal) throw makeError("TOTAL_MISMATCH", "Total amount does not match sale items");
  if (draft.payment_method === "CASH" && Number(draft.cash_received) < Number(draft.total_amount)) throw makeError("INVALID_CASH", "Cash received less than total");
  var row = {
    id: draft.id,
    branch_id: branchId,
    user_id: session.user_id,
    sale_type: draft.sale_type,
    payment_method: draft.payment_method,
    total_amount: Number(draft.total_amount),
    cash_received: Number(draft.cash_received || 0),
    change_given: Number(draft.change_given || 0),
    total_cogs: 0,
    client_created_at: draft.client_created_at,
    server_received_at: serverReceivedAt,
    business_date: rowBusinessDate,
    synced_at: serverReceivedAt,
    reconcile_status: "pending",
    status: "processing",
    late_after_reconcile: isLateAfterReconcile,
    device_id: deviceId
  };
  CacheService.getScriptCache().put("sale:" + row.id, "1", 21600);
  SheetDB_insert("Sales", row);
  (draft.items || []).forEach(function (item) {
    var product = productsById[item.product_id];
    flag = Sales_priceFlag(flag, draft, item, product, config);
    var consumed = Inventory_consumeFinished(branchId, item.product_id, Number(item.qty), false);
    if (consumed.shortBy > 0) flag = Sales_addFlag(flag, "OVERSOLD");
    totalCogs += consumed.totalCost;
    consumed.breakdown.forEach(function (piece) {
      StockMovements_record(branchId, piece.lot_id, product.item_code || item.product_id, "sale", -Number(piece.qty), -Number(piece.qty) * Number(piece.unit_cost), draft.id);
    });
    SheetDB_insert("SaleItems", {
      id: item.id || newId("SIT"),
      sale_id: draft.id,
      product_id: item.product_id,
      qty: Number(item.qty),
      unit_price: Number(item.unit_price),
      is_freebie: item.is_freebie === true,
      unit_cost: item.qty ? Math.round(consumed.totalCost / Number(item.qty)) : 0,
      lot_breakdown: JSON.stringify(consumed.breakdown)
    });
  });

  row.total_cogs = totalCogs;
  row.status = "active";
  SheetDB_update("Sales", "id", row.id, { total_cogs: totalCogs, status: "active" });
  DailySummary_addSale(row);
  Audit_log(session, "SALE_CREATE", row.id, row, true, flag, deviceId);
  return { id: row.id, status: "ok", flag: flag };
}

// GAP-06: fast idempotency — CacheService first, then a TextFinder scoped to the id column
// (avoids reading the entire Sales sheet on every incoming bill).
function Sales_exists(saleId) {
  var cache = CacheService.getScriptCache();
  if (cache.get("sale:" + saleId)) return true;
  var sheet = SheetDB_ss().getSheetByName("Sales");
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  var found = sheet.getRange(2, 1, lastRow - 1, 1).createTextFinder(String(saleId)).matchEntireCell(true).findNext();
  if (found) { cache.put("sale:" + saleId, "1", 21600); return true; }
  var itemSheet = SheetDB_ss().getSheetByName("SaleItems");
  var itemLastRow = itemSheet.getLastRow();
  if (itemLastRow >= 2) {
    var itemFound = itemSheet.getRange(2, 2, itemLastRow - 1, 1).createTextFinder(String(saleId)).matchEntireCell(true).findNext();
    if (itemFound) { cache.put("sale:" + saleId, "1", 21600); return true; }
  }
  return false;
}

function Sales_priceFlag(current, draft, item, product, config) {
  if (!product || item.is_freebie === true || draft.sale_type === "freebie") return current;
  var sellPrice = Number(draft.sale_type === "staff" ? (product.staff_price || 0) : (product.sell_price || 0));
  var unitPrice = Number(item.unit_price || 0);
  if (unitPrice !== sellPrice) {
    current = Sales_addFlag(current, "PRICE_OVERRIDE");
    if (unitPrice < Math.round(sellPrice * Number(config.suspicious_price_pct || 50) / 100)) {
      current = Sales_addFlag(current, "SUSPICIOUS");
    }
  }
  return current;
}

function Sales_isInt(value) {
  return isFinite(value) && Math.floor(value) === value;
}

function Sales_addFlag(current, next) {
  var flags = String(current || "").split(",").filter(function (item) { return item; });
  if (flags.indexOf(next) < 0) flags.push(next);
  return flags.join(",");
}

function Sales_reopenReconciliationIfNeeded(branchId, businessDateValue) {
  var reconciled = SheetDB_all("Reconciliations").filter(function (row) {
    return row.branch_id === branchId && row.business_date === businessDateValue && row.status === "reconciled";
  });
  if (!reconciled.length) return false;
  reconciled.forEach(function (row) {
    SheetDB_update("Reconciliations", "id", row.id, { status: "reopened", note: appendNote(row.note, "Late-arriving sale reopened this day.") });
  });
  return true;
}

function appendNote(existing, addition) {
  return existing ? existing + "\n" + addition : addition;
}

function Sales_void(payload, session, deviceId) {
  var sale = SheetDB_findById("Sales", "id", payload.sale_id);
  if (!sale) throw makeError("NOT_FOUND", "Sale not found");
  if (sale.status === "voided") return sale;
  if (sale.reconcile_status === "reconciled") throw makeError("RECONCILED", "Sale already reconciled");
  var ageMinutes = (Date.now() - new Date(sale.server_received_at).getTime()) / 60000;
  var config = Config_get();
  if (session.role === "staff" && (sale.user_id !== session.user_id || ageMinutes > Number(config.void_window_minutes || 15))) {
    throw makeError("VOID_WINDOW_EXPIRED", "Void window expired");
  }
  SheetDB_all("SaleItems").filter(function (item) { return item.sale_id === payload.sale_id; }).forEach(function (item) {
    var breakdown = JSON.parse(item.lot_breakdown || "[]");
    Inventory_restoreFinished(breakdown);
    var product = SheetDB_findById("Products", "id", item.product_id);
    breakdown.forEach(function (piece) {
      StockMovements_record(sale.branch_id, piece.lot_id, product ? product.item_code : item.product_id, "void", Number(piece.qty), Number(piece.qty) * Number(piece.unit_cost), sale.id);
    });
  });
  SheetDB_update("Sales", "id", payload.sale_id, { status: "voided", void_reason: payload.reason || "", voided_by: session.user_id, voided_at: nowIso() });
  DailySummary_voidSale(sale);
  Audit_log(session, "SALE_VOID", payload.sale_id, payload, true, "SUSPICIOUS", deviceId);
  return { id: payload.sale_id, status: "voided" };
}

function DailySummary_addSale(sale) {
  var id = "DSM-" + sale.branch_id + "-" + sale.business_date;
  var row = SheetDB_findById("DailySummary", "id", id);
  var payKey = paymentSummaryKey(sale.payment_method);
  var revKey = "rev_" + sale.sale_type;
  if (!row) {
    row = { id: id, branch_id: sale.branch_id, business_date: sale.business_date, rev_normal: 0, rev_discount: 0, rev_freebie: 0, rev_staff: 0, pay_qr1: 0, pay_qr2: 0, pay_grab: 0, pay_cash: 0, pay_thai: 0, pay_other: 0, cogs_total: 0, wastage_value: 0, bill_count: 0, void_count: 0, last_rebuilt_at: nowIso() };
    SheetDB_insert("DailySummary", row);
  }
  var patch = {};
  patch[revKey] = Number(row[revKey] || 0) + Number(sale.total_amount);
  patch[payKey] = Number(row[payKey] || 0) + Number(sale.total_amount);
  patch.cogs_total = Number(row.cogs_total || 0) + Number(sale.total_cogs);
  patch.bill_count = Number(row.bill_count || 0) + 1;
  patch.last_rebuilt_at = nowIso();
  SheetDB_update("DailySummary", "id", id, patch);
}

function DailySummary_voidSale(sale) {
  var id = "DSM-" + sale.branch_id + "-" + sale.business_date;
  var row = SheetDB_findById("DailySummary", "id", id);
  if (!row) return;
  var patch = {};
  patch["rev_" + sale.sale_type] = Math.max(0, Number(row["rev_" + sale.sale_type] || 0) - Number(sale.total_amount));
  patch[paymentSummaryKey(sale.payment_method)] = Math.max(0, Number(row[paymentSummaryKey(sale.payment_method)] || 0) - Number(sale.total_amount));
  patch.cogs_total = Math.max(0, Number(row.cogs_total || 0) - Number(sale.total_cogs));
  patch.bill_count = Math.max(0, Number(row.bill_count || 0) - 1);
  patch.void_count = Number(row.void_count || 0) + 1;
  SheetDB_update("DailySummary", "id", id, patch);
}

function DailySummary_addVoidCount(branchId, businessDateValue, count) {
  if (!count || Number(count) <= 0) return;
  var id = "DSM-" + branchId + "-" + businessDateValue;
  var row = SheetDB_findById("DailySummary", "id", id);
  if (!row) {
    row = { id: id, branch_id: branchId, business_date: businessDateValue, rev_normal: 0, rev_discount: 0, rev_freebie: 0, rev_staff: 0, pay_qr1: 0, pay_qr2: 0, pay_grab: 0, pay_cash: 0, pay_thai: 0, pay_other: 0, cogs_total: 0, wastage_value: 0, bill_count: 0, void_count: 0, last_rebuilt_at: nowIso() };
    SheetDB_insert("DailySummary", row);
  }
  SheetDB_update("DailySummary", "id", id, {
    void_count: Number(row.void_count || 0) + Number(count),
    last_rebuilt_at: nowIso()
  });
}

function DailySummary_addWastage(branchId, businessDateValue, value) {
  var id = "DSM-" + branchId + "-" + businessDateValue;
  var row = SheetDB_findById("DailySummary", "id", id);
  if (!row) {
    row = { id: id, branch_id: branchId, business_date: businessDateValue, rev_normal: 0, rev_discount: 0, rev_freebie: 0, rev_staff: 0, pay_qr1: 0, pay_qr2: 0, pay_grab: 0, pay_cash: 0, pay_thai: 0, pay_other: 0, cogs_total: 0, wastage_value: 0, bill_count: 0, void_count: 0, last_rebuilt_at: nowIso() };
    SheetDB_insert("DailySummary", row);
  }
  SheetDB_update("DailySummary", "id", id, {
    wastage_value: Number(row.wastage_value || 0) + Number(value || 0),
    last_rebuilt_at: nowIso()
  });
}

function paymentSummaryKey(method) {
  return { QR1: "pay_qr1", QR2: "pay_qr2", GRAB: "pay_grab", CASH: "pay_cash", THAI_HELP_THAI: "pay_thai", OTHER: "pay_other" }[method] || "pay_other";
}
