function App_snapshot(payload, session) {
  var branchId = session.role === "staff" ? session.branch_id : (payload.branch_id || "ALL");
  var cutoffDate = Snapshot_recentCutoffDate();
  var sales = Snapshot_rows("Sales").filter(function (sale) {
    if (!Snapshot_inRecentBusinessDate(sale.business_date, cutoffDate)) return false;
    if (session.role !== "staff") return Snapshot_inBranch(sale.branch_id, branchId);
    return sale.branch_id === session.branch_id && sale.device_id === session.device_id;
  });
  var saleIds = sales.reduce(function (acc, sale) {
    acc[sale.id] = true;
    return acc;
  }, {});

  var snapshot = {
    users: Snapshot_users(session),
    branches: Snapshot_rows("Branches").filter(function (branch) { return branch.active !== false; }),
    products: Snapshot_products(session),
    finishedLots: Snapshot_rows("FinishedStock").filter(function (lot) {
      return Snapshot_inBranch(lot.branch_id, branchId);
    }),
    rawMaterials: session.role === "staff" ? [] : Snapshot_rows("RawMaterials"),
    supplyItems: session.role === "staff" ? [] : Snapshot_rows("SupplyItems"),
    rawLots: session.role === "staff" ? [] : Snapshot_rows("RawLots").filter(function (lot) {
      return Snapshot_inBranch(lot.branch_id, branchId);
    }),
    recipes: session.role === "staff" ? [] : Snapshot_rows("Recipes"),
    recipeItems: session.role === "staff" ? [] : Snapshot_rows("RecipeItems"),
    sales: sales,
    saleItems: Snapshot_rows("SaleItems").filter(function (item) { return saleIds[item.sale_id] === true; }),
    wastage: Snapshot_rows("Wastage").filter(function (row) {
      return Snapshot_inBranch(row.branch_id, branchId) && Snapshot_inRecentTimestamp(row.created_at, cutoffDate);
    }),
    goodsReceipts: session.role === "staff" ? [] : Snapshot_rows("GoodsReceipts").filter(function (row) {
      return Snapshot_inBranch(row.branch_id, branchId);
    }),
    productionOrders: session.role === "staff" ? [] : Snapshot_rows("ProductionOrders").filter(function (row) {
      return Snapshot_inBranch(row.branch_id, branchId);
    }),
    stockAdjustments: session.role === "staff" ? [] : Snapshot_rows("StockAdjustments"),
    reconciliations: session.role === "staff" ? [] : Snapshot_rows("Reconciliations").filter(function (row) {
      return Snapshot_inBranch(row.branch_id, branchId);
    }),
    expenses: session.role === "staff" ? [] : Snapshot_rows("Expenses").filter(function (row) {
      return Snapshot_inBranch(row.branch_id, branchId);
    }),
    dailySummary: Snapshot_rows("DailySummary").filter(function (row) {
      return Snapshot_inBranch(row.branch_id, branchId);
    }),
    stockMovements: session.role === "staff" ? [] : Snapshot_rows("StockMovements").filter(function (row) {
      return Snapshot_inBranch(row.branch_id, branchId) && Snapshot_inRecentTimestamp(row.date, cutoffDate);
    }),
    priceHistory: session.role === "owner" ? Snapshot_rows("PriceHistory") : [],
    devices: session.role === "owner" ? Snapshot_rows("Devices") : Snapshot_rows("Devices").filter(function (device) {
      return device.device_id === session.device_id;
    }),
    errorLog: session.role === "owner" ? Snapshot_rows("ErrorLog") : [],
    auditLog: session.role === "owner" ? Snapshot_rows("AuditLog").slice(-250) : [],
    config: Config_get()
  };

  return snapshot;
}

function Snapshot_recentCutoffDate() {
  return Utilities.formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "Asia/Bangkok", "yyyy-MM-dd");
}

function Snapshot_inRecentBusinessDate(value, cutoffDate) {
  return !value || String(value) >= cutoffDate;
}

function Snapshot_inRecentTimestamp(value, cutoffDate) {
  return businessDateFrom(value, Config_get()) >= cutoffDate;
}

function Snapshot_products(session) {
  var rows = Snapshot_rows("Products");
  rows = rows.map(Inventory_withoutImageData);
  if (session.role === "staff") return rows.filter(function (product) { return product.active !== false; });
  return rows;
}

function Snapshot_users(session) {
  if (session.role !== "owner") return [];
  return Snapshot_rows("Users").map(function (user) {
    return {
      id: user.id,
      user_id: user.user_id,
      password: "***",
      display_name: user.display_name,
      role: user.role,
      branch_id: user.branch_id,
      active: user.active,
      approval_pin: user.approval_pin_hash ? "***" : "",
      failed_attempts: user.failed_attempts,
      locked_until: user.locked_until || "",
      pin_failed_attempts: user.pin_failed_attempts || 0,
      pin_locked_until: user.pin_locked_until || ""
    };
  });
}

function Snapshot_inBranch(rowBranch, selected) {
  return selected === "ALL" || rowBranch === selected;
}

function Snapshot_rows(sheetName) {
  return SheetDB_all(sheetName).map(function (row) {
    var clone = {};
    Object.keys(row).forEach(function (key) {
      if (key === "_row") return;
      clone[key] = Snapshot_value(sheetName, key, row[key]);
    });
    return clone;
  });
}

function Snapshot_value(sheetName, key, value) {
  if (value instanceof Date) {
    if (key === "expense_month") return Utilities.formatDate(value, "Asia/Bangkok", "yyyy-MM");
    if (/_date$/.test(key) || key === "business_date" || key === "expense_month") {
      return Utilities.formatDate(value, "Asia/Bangkok", "yyyy-MM-dd");
    }
    return value.toISOString();
  }
  if (Snapshot_jsonFields()[sheetName + "." + key]) return Snapshot_json(value, key);
  if (Snapshot_booleanFields()[sheetName + "." + key]) return Snapshot_boolean(value);
  if (Snapshot_numberFields()[sheetName + "." + key]) return Number(value || 0);
  return value;
}

function Snapshot_json(value, key) {
  if (!value) return key === "lot_breakdown" ? [] : {};
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return key === "lot_breakdown" ? [] : {};
  }
}

function Snapshot_boolean(value) {
  if (value === true || value === false) return value;
  return String(value).toUpperCase() === "TRUE";
}

function Snapshot_numberFields() {
  var fields = [
    "Products.sell_price", "Products.staff_price", "Products.shelf_life_days",
    "FinishedStock.qty_in", "FinishedStock.qty_remaining", "FinishedStock.unit_cost",
    "Sales.total_amount", "Sales.cash_received", "Sales.change_given", "Sales.total_cogs",
    "SaleItems.qty", "SaleItems.unit_price", "SaleItems.unit_cost",
    "Wastage.qty", "Wastage.total_cost_value",
    "RawMaterials.display_factor",
    "RawLots.qty_in", "RawLots.qty_remaining", "RawLots.unit_cost",
    "StockMovements.qty_change", "StockMovements.value_change",
    "RecipeItems.qty_per_unit",
    "ProductionOrders.qty_produced", "ProductionOrders.total_material_cost", "ProductionOrders.total_packaging_cost", "ProductionOrders.unit_cost_locked",
    "GoodsReceipts.qty", "GoodsReceipts.unit_cost",
    "StockAdjustments.qty_before", "StockAdjustments.qty_after",
    "Reconciliations.diff_total",
    "Expenses.amount", "Expenses.purchase_qty",
    "DailySummary.rev_normal", "DailySummary.rev_discount", "DailySummary.rev_freebie", "DailySummary.rev_staff",
    "DailySummary.pay_qr1", "DailySummary.pay_qr2", "DailySummary.pay_grab", "DailySummary.pay_cash", "DailySummary.pay_thai", "DailySummary.pay_other",
    "DailySummary.cogs_total", "DailySummary.wastage_value", "DailySummary.bill_count", "DailySummary.void_count",
    "PriceHistory.old_value", "PriceHistory.new_value",
    "Users.failed_attempts"
  ];
  return fields.reduce(function (acc, field) {
    acc[field] = true;
    return acc;
  }, {});
}

function Snapshot_booleanFields() {
  var fields = [
    "Branches.active", "Products.is_perishable", "Products.active",
    "Sales.late_after_reconcile", "SaleItems.is_freebie",
    "RawMaterials.is_packaging", "RawMaterials.active", "SupplyItems.active", "Recipes.active",
    "AuditLog.success"
  ];
  return fields.reduce(function (acc, field) {
    acc[field] = true;
    return acc;
  }, {});
}

function Snapshot_jsonFields() {
  var fields = [
    "SaleItems.lot_breakdown",
    "Wastage.lot_breakdown",
    "ProductionOrders.consumption_detail",
    "Reconciliations.system",
    "Reconciliations.actual"
  ];
  return fields.reduce(function (acc, field) {
    acc[field] = true;
    return acc;
  }, {});
}
