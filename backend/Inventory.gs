function Inventory_productList() {
  return { products: SheetDB_all("Products").filter(function (product) { return String(product.active).toUpperCase() !== "FALSE"; }).map(Inventory_withoutImageData) };
}

function Inventory_productImages(session) {
  var products = SheetDB_all("Products").filter(function (product) {
    return session.role !== "staff" || String(product.active).toUpperCase() !== "FALSE";
  });
  return { images: products.map(function (product) { return { id: product.id, image_data: product.image_data || "" }; }) };
}

function Inventory_withoutImageData(product) {
  var clone = {};
  Object.keys(product).forEach(function (key) {
    if (key !== "image_data" && key !== "_row") clone[key] = product[key];
  });
  return clone;
}

function Inventory_stockMyBranch(branchId) {
  return SheetDB_all("FinishedStock").filter(function (lot) {
    return lot.branch_id === branchId && Number(lot.qty_remaining) > 0;
  });
}

function Inventory_list() {
  return {
    products: SheetDB_all("Products").map(Inventory_withoutImageData),
    finishedLots: SheetDB_all("FinishedStock"),
    rawMaterials: SheetDB_all("RawMaterials"),
    supplyItems: SheetDB_all("SupplyItems"),
    rawLots: SheetDB_all("RawLots"),
    stockMovements: SheetDB_all("StockMovements")
  };
}

function Inventory_consumeFinished(branchId, productId, qtyNeeded, sortByExpiry) {
  var lots = SheetDB_all("FinishedStock").filter(function (lot) {
    return lot.branch_id === branchId && lot.product_id === productId && Number(lot.qty_remaining) > 0;
  }).sort(function (a, b) {
    return sortByExpiry ? String(a.expiry_date).localeCompare(String(b.expiry_date)) : String(a.received_date).localeCompare(String(b.received_date));
  });
  return consumeLots("FinishedStock", "lot_id", lots, qtyNeeded);
}

function Inventory_consumeRaw(branchId, materialId, qtyNeeded) {
  var lots = SheetDB_all("RawLots").filter(function (lot) {
    return lot.branch_id === branchId && lot.material_id === materialId && Number(lot.qty_remaining) > 0;
  }).sort(function (a, b) {
    return String(a.purchase_date).localeCompare(String(b.purchase_date));
  });
  return consumeLots("RawLots", "lot_id", lots, qtyNeeded);
}

function Inventory_previewRaw(branchId, materialId, qtyNeeded) {
  var lots = SheetDB_all("RawLots").filter(function (lot) {
    return lot.branch_id === branchId && lot.material_id === materialId && Number(lot.qty_remaining) > 0;
  }).sort(function (a, b) {
    return String(a.purchase_date).localeCompare(String(b.purchase_date));
  });
  var remaining = Number(qtyNeeded);
  var totalCost = 0;
  lots.forEach(function (lot) {
    if (remaining <= 0) return;
    var take = Math.min(Number(lot.qty_remaining), remaining);
    totalCost += take * Number(lot.unit_cost);
    remaining -= take;
  });
  return { totalCost: totalCost, shortBy: remaining };
}

function consumeLots(sheetName, keyName, lots, qtyNeeded) {
  var remaining = Number(qtyNeeded);
  var totalCost = 0;
  var breakdown = [];
  lots.forEach(function (lot) {
    if (remaining <= 0) return;
    var take = Math.min(Number(lot.qty_remaining), remaining);
    breakdown.push({ lot_id: lot.lot_id, qty: take, unit_cost: Number(lot.unit_cost) });
    totalCost += take * Number(lot.unit_cost);
    remaining -= take;
    SheetDB_update(sheetName, keyName, lot.lot_id, { qty_remaining: Number(lot.qty_remaining) - take });
  });
  return { breakdown: breakdown, totalCost: totalCost, shortBy: remaining };
}

function Inventory_restoreFinished(breakdown) {
  (breakdown || []).forEach(function (piece) {
    var lot = SheetDB_findById("FinishedStock", "lot_id", piece.lot_id);
    if (lot) SheetDB_update("FinishedStock", "lot_id", piece.lot_id, { qty_remaining: Number(lot.qty_remaining) + Number(piece.qty) });
  });
}

function Inventory_goodsReceive(payload, session, deviceId) {
  var receivedDate = payload.received_date || businessDate();
  if (receivedDate > businessDate()) throw makeError("FUTURE_DATE", "Received date cannot be in the future");
  if (Number(payload.qty) <= 0 || Number(payload.unit_cost) < 0) throw makeError("BAD_REQUEST", "Invalid quantity or cost");
  var product = SheetDB_findById("Products", "id", payload.product_id);
  if (!product) throw makeError("BAD_PRODUCT", "Product not found");
  var receipt = {
    id: newId("GRC"),
    branch_id: payload.branch_id,
    user_id: session.user_id,
    product_id: payload.product_id,
    qty: Number(payload.qty),
    unit_cost: Number(payload.unit_cost),
    received_date: receivedDate
  };
  SheetDB_insert("GoodsReceipts", receipt);
  var expiry = dateOffset(receipt.received_date, Number(product.shelf_life_days || 1));
  var lot = {
    lot_id: newId("FLOT"),
    branch_id: receipt.branch_id,
    product_id: receipt.product_id,
    qty_in: receipt.qty,
    qty_remaining: receipt.qty,
    unit_cost: receipt.unit_cost,
	    received_date: receipt.received_date,
	    expiry_date: expiry,
	    source: "parent_receive",
	    source_ref: receipt.id,
	    extend_count: 0
	  };
  SheetDB_insert("FinishedStock", lot);
  StockMovements_record(lot.branch_id, lot.lot_id, productItemCode(receipt.product_id), "receive", lot.qty_in, lot.qty_in * lot.unit_cost, receipt.id);
  Audit_log(session, "GOODS_RECEIVE", receipt.id, receipt, true, "", deviceId);
  return receipt;
}

function Inventory_rawLotPurchase(payload, session, deviceId) {
  var purchaseDate = payload.purchase_date || businessDate();
  if (purchaseDate > businessDate()) throw makeError("FUTURE_DATE", "Purchase date cannot be in the future");
  if (Number(payload.qty) <= 0 || Number(payload.total_cost) < 0) throw makeError("BAD_REQUEST", "Invalid quantity or cost");
  if (payload.payment_channel) Inventory_validatePaymentMethod(payload.payment_channel);
  var lot = {
    lot_id: newId("RLOT"),
    material_id: payload.material_id,
    branch_id: payload.branch_id,
    qty_in: Number(payload.qty),
    qty_remaining: Number(payload.qty),
    unit_cost: Math.round(Number(payload.total_cost) / Math.max(Number(payload.qty), 1)),
    purchase_date: purchaseDate,
    supplier_note: payload.supplier_note || ""
  };
  SheetDB_insert("RawLots", lot);
  StockMovements_record(lot.branch_id, lot.lot_id, materialItemCode(payload.material_id), "receive", lot.qty_in, Number(payload.total_cost), lot.lot_id);
  Audit_log(session, "RAWLOT_PURCHASE", lot.lot_id, lot, true, "", deviceId);
  // approve2 §5.2: "ซื้อเข้าคลัง" mirrors the cash outflow into Expenses, linked by ref_id = lot_id.
  if (payload.as_expense) {
    var expense = {
      id: newId("EXP"),
      branch_id: lot.branch_id,
      user_id: session.user_id,
      expense_type: "supply_purchase",
      amount: Number(payload.total_cost),
      expense_month: String(purchaseDate).slice(0, 7),
      note: lot.supplier_note || "ซื้อเข้าคลัง",
      created_at: nowIso(),
      payment_channel: payload.payment_channel || "",
      purchase_qty: lot.qty_in,
      item_code: materialItemCode(payload.material_id),
      ref_id: lot.lot_id
    };
    SheetDB_insert("Expenses", expense);
    Audit_log(session, "EXPENSE_CREATE", expense.id, { ref_id: lot.lot_id, source: "rawlot.purchase" }, true, "", deviceId);
    return { lot: lot, expense: expense };
  }
  return lot;
}

function materialItemCode(materialId) {
  var material = SheetDB_findById("RawMaterials", "id", materialId);
  return material ? material.item_code : materialId;
}

function StockMovements_record(branchId, lotId, itemCode, type, qtyChange, valueChange, refId) {
  SheetDB_insert("StockMovements", {
    id: newId("MOV"),
    date: nowIso(),
    branch_id: branchId,
    lot_id: lotId,
    item_code: itemCode,
    type: type,
    qty_change: qtyChange,
    value_change: valueChange,
    ref_id: refId
  });
}

function Inventory_extendExpiry(payload, session, deviceId) {
  var lot = SheetDB_findById("FinishedStock", "lot_id", payload.lot_id);
  if (!lot) throw makeError("NOT_FOUND", "Lot not found");
  if (session.role === "staff" && lot.branch_id !== session.branch_id) throw makeError("FORBIDDEN", "Cannot update another branch lot");
  var extendCount = Number(lot.extend_count || 0);
  if (session.role === "staff" && extendCount >= 2) throw makeError("EXTEND_LIMIT", "Lot has already been extended twice");
  var next = dateOffset(lot.expiry_date, 1);
  SheetDB_update("FinishedStock", "lot_id", payload.lot_id, { expiry_date: next, extend_count: extendCount + 1 });
  Audit_log(session, "STOCK_EXTEND_EXPIRY", payload.lot_id, { expiry_date: next, extend_count: extendCount + 1 }, true, extendCount + 1 > 2 ? "SUSPICIOUS" : "", deviceId);
  return { lot_id: payload.lot_id, expiry_date: next, extend_count: extendCount + 1 };
}

function Inventory_validatePaymentMethod(value) {
  if (["QR1", "QR2", "GRAB", "CASH", "THAI_HELP_THAI", "OTHER"].indexOf(String(value)) < 0) {
    throw makeError("BAD_PAYMENT_METHOD", "Invalid payment method");
  }
}

function Inventory_stockAdjust(payload, session, deviceId) {
  var approved = Inventory_approveOwnerPin(payload.owner_pin || "", session, payload.lot_id, deviceId);
  if (!approved) {
    throw makeError("PIN_FAILED", "Owner PIN invalid");
  }
  var sheetName = payload.target_type === "raw_lot" ? "RawLots" : "FinishedStock";
  var lot = SheetDB_findById(sheetName, "lot_id", payload.lot_id);
  if (!lot) throw makeError("NOT_FOUND", "Lot not found");
  var before = Number(lot.qty_remaining);
  SheetDB_update(sheetName, "lot_id", payload.lot_id, { qty_remaining: Number(payload.qty_after) });
  var itemCode = payload.target_type === "raw_lot" ? materialItemCode(lot.material_id) : productItemCode(lot.product_id);
  StockMovements_record(lot.branch_id, payload.lot_id, itemCode, "adjust", Number(payload.qty_after) - before, (Number(payload.qty_after) - before) * Number(lot.unit_cost || 0), payload.lot_id);
  var row = {
    id: newId("ADJ"),
    user_id: session.user_id,
    approved_by: approved.user_id,
    target_type: payload.target_type,
    lot_id: payload.lot_id,
    qty_before: before,
    qty_after: Number(payload.qty_after),
    reason: payload.reason || "",
    created_at: nowIso()
  };
  SheetDB_insert("StockAdjustments", row);
  Audit_log(session, "STOCK_ADJUST", row.id, row, true, "SUSPICIOUS", deviceId);
  return row;
}

function Inventory_approveOwnerPin(pin, session, refId, deviceId) {
  var config = Config_get();
  var owners = SheetDB_all("Users").filter(function (user) {
    return user.role === "owner" && String(user.active).toUpperCase() !== "FALSE" && user.approval_pin_hash;
  });
  var locked = owners.filter(function (owner) {
    return owner.pin_locked_until && new Date(owner.pin_locked_until) > new Date();
  })[0];
  if (locked) {
    Audit_log(session, "PIN_LOCKED", refId || locked.user_id, { user_id: locked.user_id, pin_locked_until: locked.pin_locked_until }, false, "SUSPICIOUS", deviceId);
    throw makeError("PIN_LOCKED", "Owner PIN approval is temporarily locked");
  }
  var approved = owners.filter(function (owner) {
    return hashSecret(pin, owner.salt || "", true) === owner.approval_pin_hash;
  })[0];
  if (approved) {
    if (Number(approved.pin_failed_attempts || 0) || approved.pin_locked_until) {
      SheetDB_update("Users", "id", approved.id, { pin_failed_attempts: 0, pin_locked_until: "" });
    }
    return approved;
  }
  owners.forEach(function (owner) {
    var attempts = Number(owner.pin_failed_attempts || 0) + 1;
    var maxAttempts = Number(config.login_lockout_attempts || 5);
    var lockedUntil = attempts >= maxAttempts ? new Date(Date.now() + Number(config.lockout_minutes || 15) * 60 * 1000).toISOString() : "";
    SheetDB_update("Users", "id", owner.id, { pin_failed_attempts: attempts, pin_locked_until: lockedUntil });
  });
  Audit_log(session, "PIN_FAILED", refId || "OWNER_PIN", { failed_attempts: owners.length ? Number(owners[0].pin_failed_attempts || 0) + 1 : 1 }, false, "SUSPICIOUS", deviceId);
  return null;
}
