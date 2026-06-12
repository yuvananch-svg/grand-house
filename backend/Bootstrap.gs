function setupSheets() {
  SheetDB_setupSheets();
  SheetDB_ss().setSpreadsheetTimeZone("Asia/Bangkok");
  removeEmptyDefaultSheet();
  seedConfig();
  seedBranches();
  seedUsers();
  seedProducts();
  migrateCategories();
  seedRawMaterials();
  seedSupplyItems();
  seedInitialStock();
  seedRecipes();
  seedExpenses();
  return {
    ok: true,
    spreadsheet_id: PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID"),
    sheets: Object.keys(SHEETS).length
  };
}

function configureDeployment(settings) {
  settings = settings || {};
  var props = {};
  if (settings.spreadsheet_id) props.SPREADSHEET_ID = settings.spreadsheet_id;
  if (settings.pepper) props.PEPPER = settings.pepper;
  if (settings.env) props.ENV = settings.env;
  if (settings.alert_email) props.ALERT_EMAIL = settings.alert_email;
  if (settings.seed_owner_password) props.SEED_OWNER_PASSWORD = settings.seed_owner_password;
  if (settings.seed_owner_pin) props.SEED_OWNER_PIN = settings.seed_owner_pin;
  if (settings.seed_office_password) props.SEED_OFFICE_PASSWORD = settings.seed_office_password;
  if (settings.seed_kaset_password) props.SEED_KASET_PASSWORD = settings.seed_kaset_password;
  if (settings.seed_tharua_password) props.SEED_THARUA_PASSWORD = settings.seed_tharua_password;
  if (settings.seed_banjo_password) props.SEED_BANJO_PASSWORD = settings.seed_banjo_password;
  if (Object.keys(props).length) PropertiesService.getScriptProperties().setProperties(props);
  return {
    spreadsheet_id: PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID"),
    env: PropertiesService.getScriptProperties().getProperty("ENV") || "",
    has_pepper: !!PropertiesService.getScriptProperties().getProperty("PEPPER"),
    has_alert_email: !!PropertiesService.getScriptProperties().getProperty("ALERT_EMAIL"),
    seed_credential_status: seedCredentialStatus_()
  };
}

function removeEmptyDefaultSheet() {
  var ss = SheetDB_ss();
  var sheet = ss.getSheetByName("Sheet1");
  if (!sheet || ss.getSheets().length <= 1) return;
  var isEmpty = sheet.getLastRow() <= 1 && sheet.getLastColumn() <= 1 && sheet.getRange(1, 1).getValue() === "";
  if (isEmpty) ss.deleteSheet(sheet);
}

function seedConfig() {
  var existing = SheetDB_all("Config").reduce(function (acc, row) {
    acc[row.key] = true;
    return acc;
  }, {});
  var defaults = {
    void_window_minutes: 15,
    day_cutoff_hour: 0,
    suspicious_price_pct: 50,
    suspicious_staffsale_per_day: 5,
    suspicious_wastage_value: 50000,
    suspicious_adjust_per_week: 5,
    rate_limit_per_min: 60,
    global_rate_limit_per_min: 600,
    login_lockout_attempts: 5,
    lockout_minutes: 15,
    schema_version: 1,
    catalog_version: 1
  };
  Object.keys(defaults).forEach(function (key) {
    if (!existing[key]) SheetDB_insert("Config", { key: key, value: defaults[key] });
  });
}

function seedBranches() {
  if (SheetDB_all("Branches").length) return;
  [
    { branch_id: "BR-KASET", branch_name: "เกษตรใหม่", active: true },
    { branch_id: "BR-THARUA", branch_name: "ท่ารั้ว", active: true },
    { branch_id: "BR-BANJO", branch_name: "บ้านโจ้", active: true }
  ].forEach(function (row) { SheetDB_insert("Branches", row); });
}

function seedUsers() {
  if (SheetDB_all("Users").length) return;
  if (!PropertiesService.getScriptProperties().getProperty("PEPPER")) {
    throw makeError("CONFIG_MISSING", "PEPPER must be set before seeding users");
  }
  assertProductionSeedCredentials_();
  [
    { id: "USR-OWNER", user_id: "owner", password: seedCredential_("SEED_OWNER_PASSWORD", "owner1234"), display_name: "เจ้าของ Grand's House", role: "owner", branch_id: "ALL", approval_pin: seedCredential_("SEED_OWNER_PIN", "246810", true) },
    { id: "USR-OFFICE", user_id: "office01", password: seedCredential_("SEED_OFFICE_PASSWORD", "office1234"), display_name: "ออฟฟิศกลาง", role: "office", branch_id: "ALL" },
    { id: "USR-KASET", user_id: "kaset01", password: seedCredential_("SEED_KASET_PASSWORD", "staff1234"), display_name: "หน้าร้านเกษตรใหม่", role: "staff", branch_id: "BR-KASET" },
    { id: "USR-THARUA", user_id: "tharua01", password: seedCredential_("SEED_THARUA_PASSWORD", "staff1234"), display_name: "หน้าร้านท่ารั้ว", role: "staff", branch_id: "BR-THARUA" },
    { id: "USR-BANJO", user_id: "banjo01", password: seedCredential_("SEED_BANJO_PASSWORD", "staff1234"), display_name: "หน้าร้านบ้านโจ้", role: "staff", branch_id: "BR-BANJO" }
  ].forEach(function (user) {
    var salt = Utilities.getUuid();
    SheetDB_insert("Users", {
      id: user.id,
      user_id: user.user_id,
      password_hash: hashSecret(user.password, salt, true),
      salt: salt,
      display_name: user.display_name,
      role: user.role,
      branch_id: user.branch_id,
      active: true,
      approval_pin_hash: user.approval_pin ? hashSecret(user.approval_pin, salt, true) : "",
      failed_attempts: 0,
      locked_until: "",
      pin_failed_attempts: 0,
      pin_locked_until: ""
    });
  });
}

function deploymentEnv_() {
  return String(PropertiesService.getScriptProperties().getProperty("ENV") || "staging").toLowerCase();
}

function seedCredentialStatus_() {
  var required = [
    "SEED_OWNER_PASSWORD",
    "SEED_OWNER_PIN",
    "SEED_OFFICE_PASSWORD",
    "SEED_KASET_PASSWORD",
    "SEED_THARUA_PASSWORD",
    "SEED_BANJO_PASSWORD"
  ];
  var missing = required.filter(function (key) {
    return !PropertiesService.getScriptProperties().getProperty(key);
  });
  return { env: deploymentEnv_(), required_for_prod: required, missing: missing };
}

function assertProductionSeedCredentials_() {
  if (deploymentEnv_() !== "prod") return;
  var status = seedCredentialStatus_();
  if (status.missing.length) {
    throw makeError("CONFIG_MISSING", "Production seed credentials missing: " + status.missing.join(", "));
  }
  var props = PropertiesService.getScriptProperties();
  var demoValues = {
    SEED_OWNER_PASSWORD: "owner1234",
    SEED_OWNER_PIN: "246810",
    SEED_OFFICE_PASSWORD: "office1234",
    SEED_KASET_PASSWORD: "staff1234",
    SEED_THARUA_PASSWORD: "staff1234",
    SEED_BANJO_PASSWORD: "staff1234"
  };
  Object.keys(demoValues).forEach(function (key) {
    if (props.getProperty(key) === demoValues[key]) {
      throw makeError("UNSAFE_SEED_CREDENTIAL", key + " must not use the demo value in production");
    }
  });
  Object.keys(demoValues).forEach(function (key) {
    var value = props.getProperty(key) || "";
    if (key === "SEED_OWNER_PIN") {
      if (!/^\d{6,12}$/.test(value)) throw makeError("UNSAFE_SEED_CREDENTIAL", "SEED_OWNER_PIN must be 6-12 digits");
    } else if (value.length < 12) {
      throw makeError("UNSAFE_SEED_CREDENTIAL", key + " must be at least 12 characters");
    }
  });
}

function seedCredential_(key, stagingFallback, isPin) {
  var value = PropertiesService.getScriptProperties().getProperty(key);
  if (deploymentEnv_() === "prod") return value;
  return value || stagingFallback;
}

function seedProducts() {
  if (SheetDB_all("Products").length) return;
  [
    ["PRD-KAPRAO", "PTG-001", "ข้าวผัดกะเพรา", "ထမင်းကြော် ကပေါ်", "/products/PTG-001.svg", "rice_box", "parent", 4500, 2500, 1, true],
    ["PRD-PORKSTICKY", "PTG-002", "ข้าวเหนียวหมูปิ้ง", "ဝက်သားကင် ကောက်ညှင်း", "/products/PTG-002.svg", "rice_box", "parent", 3500, 2000, 1, true],
    ["PRD-STRAWBERRY-MILK", "PGH-001", "นมสตรอว์เบอร์รี", "စတော်ဘယ်ရီ နို့", "/products/PGH-001.svg", "drink", "self_produced", 3000, 1800, 7, true],
    ["PRD-SNACK", "PTG-003", "ขนมคบเคี้ยว", "မုန့်", "/products/PTG-003.svg", "snack", "parent", 2000, 1200, 30, false]
  ].forEach(function (row) {
    SheetDB_insert("Products", {
      id: row[0], item_code: row[1], name_th: row[2], name_my: row[3], image_url: row[4], image_data: "",
      category: row[5], source_type: row[6], sell_price: row[7], staff_price: row[8],
      shelf_life_days: row[9], is_perishable: row[10], active: true
    });
  });
}

function migrateCategories() {
  var map = {
    breakfast: "rice_box",
    food: "rice_box",
    beverage: "drink",
    sweets: "dessert",
    general: "other"
  };
  SheetDB_all("Products").forEach(function (product) {
    var next = map[String(product.category || "")];
    if (next) SheetDB_update("Products", "id", product.id, { category: next });
  });
}

function seedRawMaterials() {
  if (SheetDB_all("RawMaterials").length) return;
  [
    ["RAW-PORK", "RM-001", "หมู", "ဝက်သား", "raw_fresh", "g", "kg", 1000, false],
    ["RAW-RICE", "RM-002", "ข้าวสาร", "ဆန်", "dry_supply", "g", "kg", 1000, false],
    ["RAW-MILK", "RM-003", "นมสด", "နို့", "raw_fresh", "ml", "L", 1000, false],
    ["RAW-BOTTLE", "PK-001", "ขวดนม", "ဘူး", "dry_supply", "piece", "ชิ้น", 1, true],
    ["RAW-BOX", "PK-002", "กล่องอาหาร", "ထမင်းဘူး", "dry_supply", "piece", "ชิ้น", 1, true]
  ].forEach(function (row) {
    SheetDB_insert("RawMaterials", {
      id: row[0], item_code: row[1], name_th: row[2], name_my: row[3], warehouse: row[4],
      base_unit: row[5], display_unit: row[6], display_factor: row[7], is_packaging: row[8], active: true
    });
  });
}

function seedSupplyItems() {
  if (SheetDB_all("SupplyItems").length) return;
  SheetDB_insert("SupplyItems", {
    id: "SUP-DISHSOAP",
    item_code: "SUP-001",
    name_th: "น้ำยาล้างจาน",
    name_my: "ပန်းကန်ဆေးရည်",
    category: "cleaning",
    unit: "ขวด",
    active: true
  });
}

function seedInitialStock() {
  var today = businessDate();
  var yesterday = dateOffset(today, -1);
  var nextWeek = dateOffset(today, 7);
  if (!SheetDB_all("FinishedStock").length) {
    [
      ["FLOT-KASET-KAPRAO-1", "BR-KASET", "PRD-KAPRAO", 40, 32, 1800, today, today, "parent_receive", "GRC-SEED-1"],
      ["FLOT-KASET-MILK-1", "BR-KASET", "PRD-STRAWBERRY-MILK", 30, 22, 1200, yesterday, nextWeek, "production", "PRO-SEED-1"],
      ["FLOT-THARUA-PORK-1", "BR-THARUA", "PRD-PORKSTICKY", 35, 27, 1500, today, today, "parent_receive", "GRC-SEED-2"],
      ["FLOT-BANJO-SNACK-1", "BR-BANJO", "PRD-SNACK", 80, 73, 900, yesterday, nextWeek, "parent_receive", "GRC-SEED-3"]
    ].forEach(function (row) {
      SheetDB_insert("FinishedStock", {
        lot_id: row[0], branch_id: row[1], product_id: row[2], qty_in: row[3], qty_remaining: row[4],
        unit_cost: row[5], received_date: row[6], expiry_date: row[7], source: row[8], source_ref: row[9],
        extend_count: 0
      });
    });
  }
  if (!SheetDB_all("RawLots").length) {
    [
      ["RLOT-PORK-1", "RAW-PORK", "BR-KASET", 5000, 2000, 10, yesterday, "ตลาดเช้า"],
      ["RLOT-PORK-2", "RAW-PORK", "BR-KASET", 5000, 5000, 12, today, "ตลาดเช้า"],
      ["RLOT-MILK-1", "RAW-MILK", "BR-KASET", 20000, 15000, 2, today, "ฟาร์มท้องถิ่น"],
      ["RLOT-BOTTLE-1", "RAW-BOTTLE", "BR-KASET", 100, 72, 250, yesterday, "ร้านบรรจุภัณฑ์"],
      ["RLOT-BOX-1", "RAW-BOX", "BR-KASET", 200, 160, 300, yesterday, "ร้านบรรจุภัณฑ์"]
    ].forEach(function (row) {
      SheetDB_insert("RawLots", {
        lot_id: row[0], material_id: row[1], branch_id: row[2], qty_in: row[3], qty_remaining: row[4],
        unit_cost: row[5], purchase_date: row[6], supplier_note: row[7]
      });
    });
  }
}

function seedRecipes() {
  if (!SheetDB_all("Recipes").length) {
    SheetDB_insert("Recipes", { id: "RCP-MILK", product_id: "PRD-STRAWBERRY-MILK", name: "นมสตรอว์เบอร์รีมาตรฐาน", active: true });
  }
  if (!SheetDB_all("RecipeItems").length) {
    SheetDB_insert("RecipeItems", { id: "RCI-MILK-RAW", recipe_id: "RCP-MILK", material_id: "RAW-MILK", qty_per_unit: 250 });
    SheetDB_insert("RecipeItems", { id: "RCI-MILK-BOTTLE", recipe_id: "RCP-MILK", material_id: "RAW-BOTTLE", qty_per_unit: 1 });
  }
}

function seedExpenses() {
  if (SheetDB_all("Expenses").length) return;
  SheetDB_insert("Expenses", {
    id: "EXP-SEED-1",
    branch_id: "BR-KASET",
    user_id: "office01",
    expense_type: "utility_electric",
    amount: 320000,
    expense_month: businessDate().slice(0, 7),
    note: "ค่าไฟตัวอย่างสำหรับ staging",
    created_at: nowIso(),
    payment_channel: "",
    purchase_qty: "",
    item_code: "",
    ref_id: ""
  });
}

function dateOffset(yyyyMmDd, days) {
  var date = new Date(yyyyMmDd + "T00:00:00+07:00");
  date = new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  return Utilities.formatDate(date, "Asia/Bangkok", "yyyy-MM-dd");
}

function Config_get() {
  return SheetDB_all("Config").reduce(function (acc, row) {
    acc[row.key] = row.value;
    return acc;
  }, {});
}
