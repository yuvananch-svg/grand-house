function Production_recipeList() {
  return { recipes: SheetDB_all("Recipes"), recipeItems: SheetDB_all("RecipeItems") };
}

function Production_recipeSave(payload, session, deviceId) {
  var recipeId = newId("RCP");
  SheetDB_all("Recipes").filter(function (recipe) {
    return recipe.product_id === payload.product_id && String(recipe.active).toUpperCase() !== "FALSE";
  }).forEach(function (recipe) {
    SheetDB_update("Recipes", "id", recipe.id, { active: false });
  });
  SheetDB_insert("Recipes", { id: recipeId, product_id: payload.product_id, name: payload.name, active: true });
  (payload.items || []).forEach(function (item) {
    SheetDB_insert("RecipeItems", { id: newId("RCI"), recipe_id: recipeId, material_id: item.material_id, qty_per_unit: Number(item.qty_per_unit) });
  });
  Audit_log(session, "RECIPE_SAVE", recipeId, payload, true, "", deviceId);
  return { recipe_id: recipeId };
}

function Production_preview(payload) {
  var recipe = SheetDB_findById("Recipes", "id", payload.recipe_id);
  if (!recipe || String(recipe.active).toUpperCase() === "FALSE") throw makeError("NOT_FOUND", "Active recipe not found");
  var product = SheetDB_findById("Products", "id", recipe.product_id);
  if (!product || String(product.active).toUpperCase() === "FALSE") throw makeError("BAD_PRODUCT", "Recipe product not found or inactive");
  var items = SheetDB_all("RecipeItems").filter(function (item) { return item.recipe_id === payload.recipe_id; });
  var total = 0;
  var lines = items.map(function (item) {
    var needed = Number(item.qty_per_unit) * Number(payload.qty);
    var preview = Inventory_previewRaw(payload.branch_id, item.material_id, needed);
    total += preview.totalCost;
    return { material_id: item.material_id, needed: needed, cost: preview.totalCost, shortBy: preview.shortBy };
  });
  return { lines: lines, canRun: lines.every(function (line) { return line.shortBy === 0; }), estimated_unit_cost: Math.round(total / Math.max(Number(payload.qty), 1)) };
}

function Production_run(payload, session, deviceId) {
  var recipe = SheetDB_findById("Recipes", "id", payload.recipe_id);
  if (!recipe || String(recipe.active).toUpperCase() === "FALSE") throw makeError("NOT_FOUND", "Active recipe not found");
  var product = SheetDB_findById("Products", "id", recipe.product_id);
  if (!product || String(product.active).toUpperCase() === "FALSE") throw makeError("BAD_PRODUCT", "Recipe product not found or inactive");
  var items = SheetDB_all("RecipeItems").filter(function (item) { return item.recipe_id === payload.recipe_id; });
  var materials = SheetDB_all("RawMaterials");
  var shortages = items.map(function (item) {
    var needed = Number(item.qty_per_unit) * Number(payload.qty);
    var preview = Inventory_previewRaw(payload.branch_id, item.material_id, needed);
    return { material_id: item.material_id, shortBy: preview.shortBy };
  }).filter(function (item) { return item.shortBy > 0; });
  if (shortages.length) throw makeError("INSUFFICIENT_STOCK", "Raw material short: " + shortages[0].material_id);
  var materialCost = 0;
  var packagingCost = 0;
  var detail = {};
  items.forEach(function (item) {
    var needed = Number(item.qty_per_unit) * Number(payload.qty);
    var consumed = Inventory_consumeRaw(payload.branch_id, item.material_id, needed);
    if (consumed.shortBy > 0) throw makeError("INSUFFICIENT_STOCK", "Raw material short: " + item.material_id);
    detail[item.material_id] = consumed.breakdown;
    var material = materials.filter(function (row) { return row.id === item.material_id; })[0];
    if (material && String(material.is_packaging).toUpperCase() === "TRUE") packagingCost += consumed.totalCost;
    else materialCost += consumed.totalCost;
    consumed.breakdown.forEach(function (piece) {
      StockMovements_record(payload.branch_id, piece.lot_id, material ? material.item_code : item.material_id, "production", -Number(piece.qty), -Number(piece.qty) * Number(piece.unit_cost), payload.recipe_id);
    });
  });
  var outputLotId = newId("FLOT");
  var unitCost = Math.round((materialCost + packagingCost) / Math.max(Number(payload.qty), 1));
  SheetDB_insert("FinishedStock", {
    lot_id: outputLotId,
    branch_id: payload.branch_id,
    product_id: recipe.product_id,
    qty_in: Number(payload.qty),
    qty_remaining: Number(payload.qty),
    unit_cost: unitCost,
	    received_date: businessDate(),
	    expiry_date: dateOffset(businessDate(), Number(product.shelf_life_days || 1)),
	    source: "production",
	    source_ref: outputLotId,
	    extend_count: 0
	  });
  var order = {
    id: newId("PRO"),
    branch_id: payload.branch_id,
    user_id: session.user_id,
    recipe_id: payload.recipe_id,
    qty_produced: Number(payload.qty),
    total_material_cost: materialCost,
    total_packaging_cost: packagingCost,
    unit_cost_locked: unitCost,
    consumption_detail: JSON.stringify(detail),
    created_at: nowIso(),
    output_lot_id: outputLotId
  };
  SheetDB_insert("ProductionOrders", order);
  StockMovements_record(payload.branch_id, outputLotId, product.item_code || recipe.product_id, "production", Number(payload.qty), materialCost + packagingCost, order.id);
  Audit_log(session, "PRODUCTION_RUN", order.id, order, true, "", deviceId);
  return order;
}
