function Wastage_create(payload, session, deviceId) {
  var branchId = session.role === "staff" ? session.branch_id : payload.branch_id;
  var qty = Wastage_integerInRange(payload.qty, "BAD_QTY", 1, 10000);
  var product = SheetDB_findById("Products", "id", payload.product_id);
  if (!product || String(product.active).toUpperCase() === "FALSE") throw makeError("BAD_PRODUCT", "Product not found");
  var consumed = Inventory_consumeFinished(branchId, payload.product_id, qty, true);
  var row = {
    id: newId("WST"),
    wastage_type: "finished",
    branch_id: branchId,
    user_id: session.user_id,
    product_id: payload.product_id,
    qty: qty,
    total_cost_value: consumed.totalCost,
    lot_breakdown: JSON.stringify(consumed.breakdown),
    created_at: nowIso()
  };
  SheetDB_insert("Wastage", row);
  consumed.breakdown.forEach(function (piece) {
    StockMovements_record(branchId, piece.lot_id, productItemCode(payload.product_id), "wastage", -Number(piece.qty), -Number(piece.qty) * Number(piece.unit_cost), row.id);
  });
  DailySummary_addWastage(branchId, businessDateFrom(row.created_at, Config_get()), row.total_cost_value);
  var wflag = consumed.shortBy > 0 ? "OVERSOLD" : (row.total_cost_value > Number(Config_get().suspicious_wastage_value || 50000) ? "SUSPICIOUS" : "");
  Audit_log(session, "WASTAGE_CREATE", row.id, row, true, wflag, deviceId);
  return row;
}

function productItemCode(productId) {
  var product = SheetDB_findById("Products", "id", productId);
  return product ? product.item_code : productId;
}

function Wastage_createRaw(payload, session, deviceId) {
  var branchId = session.role === "staff" ? session.branch_id : payload.branch_id;
  var qty = Wastage_integerInRange(payload.qty, "BAD_QTY", 1, 10000);
  var material = SheetDB_findById("RawMaterials", "id", payload.material_id);
  if (!material || String(material.active).toUpperCase() === "FALSE") throw makeError("BAD_MATERIAL", "Material not found");
  var consumed = Inventory_consumeRaw(branchId, payload.material_id, qty);
  var row = {
    id: newId("WST"),
    wastage_type: "raw",
    branch_id: branchId,
    user_id: session.user_id,
    material_id: payload.material_id,
    qty: qty,
    total_cost_value: consumed.totalCost,
    lot_breakdown: JSON.stringify(consumed.breakdown),
    created_at: nowIso()
  };
  SheetDB_insert("Wastage", row);
  consumed.breakdown.forEach(function (piece) {
    StockMovements_record(branchId, piece.lot_id, materialItemCode(payload.material_id), "wastage", -Number(piece.qty), -Number(piece.qty) * Number(piece.unit_cost), row.id);
  });
  DailySummary_addWastage(branchId, businessDateFrom(row.created_at, Config_get()), row.total_cost_value);
  Audit_log(session, "RAW_WASTAGE_CREATE", row.id, row, true, consumed.shortBy > 0 ? "OVERSOLD" : "", deviceId);
  return row;
}

function Wastage_integerInRange(value, code, min, max) {
  var num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) throw makeError(code, code);
  return num;
}
