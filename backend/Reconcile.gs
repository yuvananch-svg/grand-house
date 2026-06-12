var PAYMENT_METHODS = ["QR1", "QR2", "GRAB", "CASH", "THAI_HELP_THAI", "OTHER"];

function Reconcile_getDaily(payload) {
  var system = blankPaymentMap();
  var sales = SheetDB_all("Sales").filter(function (sale) {
    return sale.branch_id === payload.branch_id && sale.business_date === payload.business_date && sale.status === "active";
  });
  sales.forEach(function (sale) {
    system[sale.payment_method] = Number(system[sale.payment_method] || 0) + Number(sale.total_amount);
  });
  return {
    system: system,
    sales: sales,
    reconciliation: SheetDB_all("Reconciliations").filter(function (row) {
      return row.branch_id === payload.branch_id && row.business_date === payload.business_date;
    })[0] || null
  };
}

function Reconcile_confirm(payload, session, deviceId) {
  var daily = Reconcile_getDaily(payload);
  var existing = daily.reconciliation;
  if (existing && existing.status !== "reopened") throw makeError("ALREADY_RECONCILED", "This day is already reconciled");
  var actual = payload.actual || {};
  var diff = PAYMENT_METHODS.reduce(function (sum, method) {
    return sum + Number(actual[method] || 0) - Number(daily.system[method] || 0);
  }, 0);
  if (diff !== 0 && !String(payload.note || "").trim()) throw makeError("NOTE_REQUIRED", "Mismatch requires a note");
  var row = {
    id: existing ? existing.id : newId("RCN"),
    branch_id: payload.branch_id,
    business_date: payload.business_date,
    system: JSON.stringify(daily.system),
    actual: JSON.stringify(actual),
    diff_total: diff,
    status: diff === 0 ? "reconciled" : "mismatch",
    reconciled_by: session.user_id,
    reconciled_at: nowIso(),
    note: payload.note || ""
  };
  if (existing) {
    SheetDB_update("Reconciliations", "id", existing.id, {
      system: row.system,
      actual: row.actual,
      diff_total: row.diff_total,
      status: row.status,
      reconciled_by: row.reconciled_by,
      reconciled_at: row.reconciled_at,
      note: row.note
    });
  } else {
    SheetDB_insert("Reconciliations", row);
  }
  daily.sales.forEach(function (sale) {
    SheetDB_update("Sales", "id", sale.id, { reconcile_status: "reconciled" });
  });
  Audit_log(session, "RECONCILE_CONFIRM", row.id, row, true, diff === 0 ? "" : "SUSPICIOUS", deviceId);
  return row;
}

function blankPaymentMap() {
  return PAYMENT_METHODS.reduce(function (acc, method) {
    acc[method] = 0;
    return acc;
  }, {});
}
