/**
 * Master Item Catalog (approve2 §4.1).
 * Single source of truth for every buy/sell/use item, classified by source prefix:
 *   PTG = parent finished goods, PGH = self-produced finished goods,
 *   RM  = raw material, PK = packaging, SUP = untracked supply.
 * item.save is owner-only; item.list is owner+office (dropdowns).
 */
function Items_list() {
  var items = [];
  SheetDB_all("Products").forEach(function (p) {
    items.push({
      id: p.id,
      item_code: p.item_code,
      name_th: p.name_th,
      name_my: p.name_my,
      type: String(p.source_type) === "parent" ? "PTG" : "PGH",
      category: p.category,
      unit: "กล่อง/ชิ้น",
      active: String(p.active).toUpperCase() !== "FALSE",
      sell_price: Number(p.sell_price) || 0,
      staff_price: Number(p.staff_price) || 0,
      source_id: p.id
    });
  });
  SheetDB_all("RawMaterials").forEach(function (m) {
    items.push({
      id: m.id,
      item_code: m.item_code,
      name_th: m.name_th,
      name_my: m.name_my,
      type: String(m.is_packaging).toUpperCase() === "TRUE" ? "PK" : "RM",
      category: m.warehouse,
      unit: m.display_unit,
      active: String(m.active).toUpperCase() !== "FALSE",
      source_id: m.id
    });
  });
  SheetDB_all("SupplyItems").forEach(function (s) {
    items.push({
      id: s.id,
      item_code: s.item_code,
      name_th: s.name_th,
      name_my: s.name_my,
      type: "SUP",
      category: s.category,
      unit: s.unit,
      active: String(s.active).toUpperCase() !== "FALSE",
      source_id: s.id
    });
  });
  return { items: items };
}

function Items_nextCode(prefix) {
  var codes = []
    .concat(SheetDB_all("Products").map(function (r) { return r.item_code; }))
    .concat(SheetDB_all("RawMaterials").map(function (r) { return r.item_code; }))
    .concat(SheetDB_all("SupplyItems").map(function (r) { return r.item_code; }));
  var max = 0;
  codes.forEach(function (code) {
    if (typeof code === "string" && code.indexOf(prefix + "-") === 0) {
      var n = Number(code.slice(prefix.length + 1));
      if (isFinite(n) && n > max) max = n;
    }
  });
  return prefix + "-" + ("000" + (max + 1)).slice(-3);
}

function Items_save(payload, session, deviceId) {
  if (session.role !== "owner") throw makeError("FORBIDDEN", "Owner only");
  var type = payload.type;
  var has = function (field) { return Object.prototype.hasOwnProperty.call(payload, field); };
  var active = has("active") ? payload.active !== false : true;

  if (type === "PTG" || type === "PGH") {
    if (has("image_data")) Items_validateImageData(payload.image_data);
    var existing = payload.id ? SheetDB_findById("Products", "id", payload.id) : null;
    if (existing) {
      ["sell_price", "staff_price"].forEach(function (field) {
        if (payload[field] != null && Number(payload[field]) !== Number(existing[field])) {
          SheetDB_insert("PriceHistory", {
            id: newId("PRH"),
            product_id: existing.id,
            field: field,
            old_value: Number(existing[field]) || 0,
            new_value: Number(payload[field]),
            changed_by: session.user_id,
            changed_at: nowIso()
          });
          Audit_log(session, "PRICE_CHANGE", existing.id, { field: field, old_value: existing[field], new_value: payload[field] }, true, "", deviceId);
        }
      });
      var patch = {};
      if (has("name_th")) patch.name_th = payload.name_th || existing.name_th;
      if (has("name_my")) patch.name_my = payload.name_my || patch.name_th || existing.name_my;
      if (has("category")) patch.category = payload.category || existing.category;
      if (has("active")) patch.active = active;
      if (has("sell_price")) patch.sell_price = Number(payload.sell_price);
      if (has("staff_price")) patch.staff_price = Number(payload.staff_price);
      if (has("shelf_life_days")) patch.shelf_life_days = Number(payload.shelf_life_days);
      if (has("is_perishable")) patch.is_perishable = payload.is_perishable;
      if (has("image_data")) patch.image_data = payload.image_data || "";
      SheetDB_update("Products", "id", existing.id, patch);
      Audit_log(session, "ITEM_SAVE", existing.id, { item_code: existing.item_code, type: type }, true, "", deviceId);
      Config_bumpCatalogVersion();
      return { item_code: existing.item_code, id: existing.id };
    }
    var code = Items_nextCode(type);
    var id = newId("PRD");
    SheetDB_insert("Products", {
      id: id, item_code: code, name_th: payload.name_th, name_my: payload.name_my || payload.name_th,
      image_url: "", image_data: payload.image_data || "", category: payload.category || "rice_box",
      source_type: type === "PTG" ? "parent" : "self_produced",
      sell_price: payload.sell_price || 0, staff_price: payload.staff_price || 0,
      shelf_life_days: payload.shelf_life_days || 1,
      is_perishable: payload.is_perishable !== false, active: active
    });
    Audit_log(session, "ITEM_SAVE", id, { item_code: code, type: type }, true, "", deviceId);
    Config_bumpCatalogVersion();
    return { item_code: code, id: id };
  }

  if (type === "RM" || type === "PK") {
    var existingMat = payload.id ? SheetDB_findById("RawMaterials", "id", payload.id) : null;
    if (existingMat) {
      var matPatch = { is_packaging: type === "PK" };
      if (has("name_th")) matPatch.name_th = payload.name_th || existingMat.name_th;
      if (has("name_my")) matPatch.name_my = payload.name_my || matPatch.name_th || existingMat.name_my;
      if (has("warehouse")) matPatch.warehouse = payload.warehouse || existingMat.warehouse;
      if (has("base_unit")) matPatch.base_unit = payload.base_unit || existingMat.base_unit;
      if (has("display_unit")) matPatch.display_unit = payload.display_unit || existingMat.display_unit;
      if (has("display_factor")) matPatch.display_factor = Number(payload.display_factor);
      if (has("active")) matPatch.active = active;
      SheetDB_update("RawMaterials", "id", existingMat.id, matPatch);
      Audit_log(session, "ITEM_SAVE", existingMat.id, { item_code: existingMat.item_code, type: type }, true, "", deviceId);
      Config_bumpCatalogVersion();
      return { item_code: existingMat.item_code, id: existingMat.id };
    }
    var matCode = Items_nextCode(type);
    var matId = newId("RAW");
    SheetDB_insert("RawMaterials", {
      id: matId, item_code: matCode, name_th: payload.name_th, name_my: payload.name_my || payload.name_th,
      warehouse: payload.warehouse || (type === "PK" ? "dry_supply" : "raw_fresh"),
      base_unit: payload.base_unit || "piece", display_unit: payload.display_unit || "ชิ้น",
      display_factor: payload.display_factor || 1, is_packaging: type === "PK", active: active
    });
    Audit_log(session, "ITEM_SAVE", matId, { item_code: matCode, type: type }, true, "", deviceId);
    Config_bumpCatalogVersion();
    return { item_code: matCode, id: matId };
  }

  // SUP
  var existingSup = payload.id ? SheetDB_findById("SupplyItems", "id", payload.id) : null;
  if (existingSup) {
    var supPatch = {};
    if (has("name_th")) supPatch.name_th = payload.name_th || existingSup.name_th;
    if (has("name_my")) supPatch.name_my = payload.name_my || supPatch.name_th || existingSup.name_my;
    if (has("category")) supPatch.category = payload.category || existingSup.category;
    if (has("unit")) supPatch.unit = payload.unit || existingSup.unit;
    if (has("active")) supPatch.active = active;
    SheetDB_update("SupplyItems", "id", existingSup.id, supPatch);
    Audit_log(session, "ITEM_SAVE", existingSup.id, { item_code: existingSup.item_code, type: "SUP" }, true, "", deviceId);
    Config_bumpCatalogVersion();
    return { item_code: existingSup.item_code, id: existingSup.id };
  }
  var supCode = Items_nextCode("SUP");
  var supId = newId("SUP");
  SheetDB_insert("SupplyItems", {
    id: supId, item_code: supCode, name_th: payload.name_th, name_my: payload.name_my || payload.name_th,
    category: payload.category || "general", unit: payload.unit || "ชิ้น", active: active
  });
  Audit_log(session, "ITEM_SAVE", supId, { item_code: supCode, type: "SUP" }, true, "", deviceId);
  Config_bumpCatalogVersion();
  return { item_code: supCode, id: supId };
}

function Items_validateImageData(value) {
  if (!value) return;
  if (typeof value !== "string" || value.indexOf("data:image/webp;base64,") !== 0 || value.length > 45000) {
    throw makeError("BAD_IMAGE", "Product image must be a WebP data URL under 45KB");
  }
}

function Config_bumpCatalogVersion() {
  var current = Number(Config_get().catalog_version) || 1;
  var next = current + 1;
  var existing = SheetDB_findById("Config", "key", "catalog_version");
  if (existing) SheetDB_update("Config", "key", "catalog_version", { value: next });
  else SheetDB_insert("Config", { key: "catalog_version", value: next });
  return next;
}
