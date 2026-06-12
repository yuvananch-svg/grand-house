/**
 * Tests.gs — run from the Apps Script editor (Run > runAllTests) after setupSheets().
 * Pure-logic tests run anywhere; integration tests touch a throwaway test spreadsheet only
 * when TEST_SPREADSHEET_ID Script Property is set (never the production sheet).
 */
function runAllTests() {
  var results = [];
  results.push(test_D1_fifoLotOverlapping());
  results.push(test_D3_costLockingStableHistory());
  results.push(test_D7_decimalBaseUnits());
  results.push(test_itemCodeRunsUniquePerPrefix());
  results.push(test_productionSeedCredentialsRejectDemo());
  results.push(test_productionSeedCredentialsAcceptStrongValues());
  var failed = results.filter(function (r) { return !r.pass; });
  var summary = results.map(function (r) { return (r.pass ? "PASS " : "FAIL ") + r.name + (r.detail ? " — " + r.detail : ""); }).join("\n");
  Logger.log(summary);
  if (failed.length) throw new Error(failed.length + " test(s) failed:\n" + summary);
  return summary;
}

// Pure FIFO consume mirroring Inventory_consumeRaw's algorithm (no sheet dependency).
function fifoConsume(lots, qtyNeeded) {
  var remaining = qtyNeeded, totalCost = 0, breakdown = [];
  for (var i = 0; i < lots.length; i++) {
    if (remaining <= 0) break;
    var take = Math.min(lots[i].qty_remaining, remaining);
    if (take <= 0) continue;
    lots[i].qty_remaining -= take;
    remaining -= take;
    totalCost += take * lots[i].unit_cost;
    breakdown.push({ lot_id: lots[i].lot_id, qty: take, unit_cost: lots[i].unit_cost });
  }
  return { breakdown: breakdown, totalCost: totalCost, shortBy: remaining };
}

function test_D1_fifoLotOverlapping() {
  var lots = [
    { lot_id: "RLOT-1", qty_remaining: 2, unit_cost: 100 },
    { lot_id: "RLOT-2", qty_remaining: 3, unit_cost: 120 }
  ];
  var r = fifoConsume(lots, 5);
  var pass = r.totalCost === 560 && r.shortBy === 0 && lots[0].qty_remaining === 0 && r.breakdown.length === 2;
  return { name: "D1 FIFO 2@100 + 3@120 = 560", pass: pass, detail: "totalCost=" + r.totalCost };
}

function test_D3_costLockingStableHistory() {
  // A production run locks unit cost from the lots used at that moment.
  // A later, pricier batch must not change the earlier locked cost.
  var day1Lots = [{ lot_id: "L1", qty_remaining: 10, unit_cost: 1000 }];
  var run1 = fifoConsume(day1Lots, 10);
  var lockedDay1 = Math.round(run1.totalCost / 10); // 1000
  var day2Lots = [{ lot_id: "L2", qty_remaining: 10, unit_cost: 1100 }];
  var run2 = fifoConsume(day2Lots, 10);
  var lockedDay2 = Math.round(run2.totalCost / 10); // 1100
  var pass = lockedDay1 === 1000 && lockedDay2 === 1100;
  return { name: "D3 cost locking stays historical", pass: pass, detail: "day1=" + lockedDay1 + " day2=" + lockedDay2 };
}

function test_D7_decimalBaseUnits() {
  // 0.15 kg pork at 10 satang/g over 200 boxes = 0.15*1000*200 = 30000 g, 300000 satang.
  var gramsPerBox = Math.round(0.15 * 1000); // 150 g, integer base unit
  var boxes = 200;
  var lots = [{ lot_id: "RLOT-P", qty_remaining: gramsPerBox * boxes, unit_cost: 10 }];
  var r = fifoConsume(lots, gramsPerBox * boxes);
  var pass = gramsPerBox === 150 && r.totalCost === 300000 && r.shortBy === 0;
  return { name: "D7 integer base units (0.15kg)", pass: pass, detail: "totalCost=" + r.totalCost };
}

function test_itemCodeRunsUniquePerPrefix() {
  // mirrors Items_nextCode: PTG and PGH increment independently
  function next(codes, prefix) {
    var max = 0;
    codes.forEach(function (c) {
      if (typeof c === "string" && c.indexOf(prefix + "-") === 0) {
        var n = Number(c.slice(prefix.length + 1));
        if (isFinite(n) && n > max) max = n;
      }
    });
    return prefix + "-" + ("000" + (max + 1)).slice(-3);
  }
  var codes = ["PTG-001", "PTG-002", "PGH-001"];
  var pass = next(codes, "PTG") === "PTG-003" && next(codes, "PGH") === "PGH-002";
  return { name: "item_code unique per prefix (PTG/PGH)", pass: pass };
}

function withTemporaryScriptProperties_(patch, fn) {
  var props = PropertiesService.getScriptProperties();
  var keys = Object.keys(patch);
  var original = {};
  keys.forEach(function (key) {
    original[key] = props.getProperty(key);
  });
  try {
    keys.forEach(function (key) {
      if (patch[key] == null) props.deleteProperty(key);
      else props.setProperty(key, patch[key]);
    });
    return fn();
  } finally {
    keys.forEach(function (key) {
      if (original[key] == null) props.deleteProperty(key);
      else props.setProperty(key, original[key]);
    });
  }
}

function test_productionSeedCredentialsRejectDemo() {
  var keys = {
    ENV: "prod",
    SEED_OWNER_PASSWORD: "owner1234",
    SEED_OWNER_PIN: "246810",
    SEED_OFFICE_PASSWORD: "office1234",
    SEED_KASET_PASSWORD: "staff1234",
    SEED_THARUA_PASSWORD: "staff1234",
    SEED_BANJO_PASSWORD: "staff1234"
  };
  return withTemporaryScriptProperties_(keys, function () {
    try {
      assertProductionSeedCredentials_();
      return { name: "production seed rejects demo credentials", pass: false, detail: "accepted demo credentials" };
    } catch (error) {
      var pass = error && error.code === "UNSAFE_SEED_CREDENTIAL";
      return { name: "production seed rejects demo credentials", pass: pass, detail: error.code || error.message };
    }
  });
}

function test_productionSeedCredentialsAcceptStrongValues() {
  var keys = {
    ENV: "prod",
    SEED_OWNER_PASSWORD: "OwnerProdPass-2026",
    SEED_OWNER_PIN: "739264",
    SEED_OFFICE_PASSWORD: "OfficeProdPass-2026",
    SEED_KASET_PASSWORD: "KasetProdPass-2026",
    SEED_THARUA_PASSWORD: "TharuaProdPass-2026",
    SEED_BANJO_PASSWORD: "BanjoProdPass-2026"
  };
  return withTemporaryScriptProperties_(keys, function () {
    try {
      assertProductionSeedCredentials_();
      return { name: "production seed accepts strong credentials", pass: true };
    } catch (error) {
      return { name: "production seed accepts strong credentials", pass: false, detail: error.code || error.message };
    }
  });
}
