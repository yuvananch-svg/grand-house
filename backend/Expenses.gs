function Expenses_create(payload, session, deviceId) {
  if (Number(payload.amount) <= 0) throw makeError("INVALID_AMOUNT", "Expense amount must be positive");
  Expenses_validateExpenseType(payload.expense_type);
  if (payload.payment_channel) Expenses_validatePaymentMethod(payload.payment_channel);
  var row = {
    id: newId("EXP"),
    branch_id: payload.branch_id,
    user_id: session.user_id,
    expense_type: payload.expense_type,
    amount: Number(payload.amount),
    expense_month: payload.expense_month,
    note: payload.note || "",
    created_at: nowIso(),
    payment_channel: payload.payment_channel || "",
    purchase_qty: payload.purchase_qty || "",
    item_code: payload.item_code || "",
    ref_id: payload.ref_id || ""
  };
  SheetDB_insert("Expenses", row);
  Audit_log(session, "EXPENSE_CREATE", row.id, row, true, "", deviceId);
  return row;
}

function Expenses_list(payload, session) {
  return SheetDB_all("Expenses").filter(function (row) {
    return session.role === "owner" || row.branch_id === payload.branch_id || session.branch_id === "ALL";
  });
}

function Expenses_validateExpenseType(value) {
  if (["salary", "utility_water", "utility_electric", "maintenance", "supply_purchase", "other"].indexOf(String(value)) < 0) {
    throw makeError("BAD_EXPENSE_TYPE", "Invalid expense type");
  }
}

function Expenses_validatePaymentMethod(value) {
  if (["QR1", "QR2", "GRAB", "CASH", "THAI_HELP_THAI", "OTHER"].indexOf(String(value)) < 0) {
    throw makeError("BAD_PAYMENT_METHOD", "Invalid payment method");
  }
}
