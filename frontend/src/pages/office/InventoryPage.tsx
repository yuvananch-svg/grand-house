import { AlertTriangle, Boxes } from "lucide-react";
import { useState } from "react";
import { Panel, SimpleTable } from "../../components/ui";
import { branchName, productById } from "../../domain/lookups";
import type { LocalState } from "../../types";
import { todayBangkok } from "../../utils/ids";
import { formatMoney, formatQuantity } from "../../utils/money";

type WarehouseTab = "parent" | "produced" | "raw_fresh" | "dry_supply";

const warehouseTabs: { key: WarehouseTab; label: string }[] = [
  { key: "parent", label: "1. ข้าวกล่องบริษัทแม่" },
  { key: "produced", label: "2. สินค้าผลิตเอง" },
  { key: "raw_fresh", label: "3. วัตถุดิบของสด" },
  { key: "dry_supply", label: "4. ของแห้ง+บรรจุภัณฑ์" }
];

function daysUntil(date: string): number {
  const target = Date.parse(`${date}T00:00:00+07:00`);
  const today = Date.parse(`${todayBangkok()}T00:00:00+07:00`);
  return Math.round((target - today) / 86_400_000);
}

function expiryBadge(date: string) {
  const d = daysUntil(date);
  if (d <= 0) return <span className="badge red">🔴 {date}</span>;
  if (d <= 3) return <span className="badge amber">🟡 {date}</span>;
  return <span className="badge green">🟢 {date}</span>;
}

export function InventoryPage({ state }: { state: LocalState }) {
  const [tab, setTab] = useState<WarehouseTab>("parent");
  const nearExpiry = state.finishedLots.filter((lot) => lot.qty_remaining > 0 && daysUntil(lot.expiry_date) <= 3);

  const finishedRows = (source: "parent_receive" | "production") => state.finishedLots
    .filter((lot) => lot.source === source)
    .map((lot) => [
      lot.lot_id,
      branchName(state, lot.branch_id),
      productById(state, lot.product_id)?.name_th || "-",
      String(lot.qty_remaining),
      `${formatMoney(lot.unit_cost)} บาท`,
      expiryBadge(lot.expiry_date)
    ]);

  const rawRows = (warehouse: "raw_fresh" | "dry_supply") => state.rawLots
    .filter((lot) => state.rawMaterials.find((item) => item.id === lot.material_id)?.warehouse === warehouse)
    .map((lot) => {
      const material = state.rawMaterials.find((item) => item.id === lot.material_id);
      return [
        lot.lot_id,
        material ? `${material.name_th} [${material.item_code}]` : "-",
        branchName(state, lot.branch_id),
        formatQuantity(lot.qty_remaining, material?.display_factor, material?.display_unit),
        `${formatMoney(lot.unit_cost)} บาท`,
        lot.purchase_date
      ];
    });

  return (
    <section className="stack">
      {nearExpiry.length > 0 && (
        <Panel title="⚠️ แจ้งเตือนใกล้/หมดอายุ (≤3 วัน)" icon={AlertTriangle}>
          <SimpleTable headers={["สาขา", "สินค้า", "คงเหลือ", "หมดอายุ"]} rows={nearExpiry
            .sort((a, b) => daysUntil(a.expiry_date) - daysUntil(b.expiry_date))
            .map((lot) => [branchName(state, lot.branch_id), productById(state, lot.product_id)?.name_th || "-", String(lot.qty_remaining), expiryBadge(lot.expiry_date)])} />
        </Panel>
      )}
      <div className="segmented">
        {warehouseTabs.map((entry) => (
          <button key={entry.key} className={tab === entry.key ? "active" : ""} onClick={() => setTab(entry.key)}>{entry.label}</button>
        ))}
      </div>
      <Panel title={warehouseTabs.find((entry) => entry.key === tab)?.label || "คลัง"} icon={Boxes}>
        {tab === "parent" && <SimpleTable headers={["ล็อต", "สาขา", "สินค้า", "คงเหลือ", "ต้นทุน", "หมดอายุ"]} rows={finishedRows("parent_receive")} empty="ยังไม่มีสต็อกในคลังนี้" />}
        {tab === "produced" && <SimpleTable headers={["ล็อต", "สาขา", "สินค้า", "คงเหลือ", "ต้นทุน", "หมดอายุ"]} rows={finishedRows("production")} empty="ยังไม่มีสต็อกในคลังนี้" />}
        {tab === "raw_fresh" && <SimpleTable headers={["ล็อต", "วัตถุดิบ", "สาขา", "คงเหลือ", "ต้นทุน/หน่วยฐาน", "วันที่ซื้อ"]} rows={rawRows("raw_fresh")} empty="ยังไม่มีสต็อกในคลังนี้" />}
        {tab === "dry_supply" && <SimpleTable headers={["ล็อต", "วัตถุดิบ/บรรจุภัณฑ์", "สาขา", "คงเหลือ", "ต้นทุน/หน่วยฐาน", "วันที่ซื้อ"]} rows={rawRows("dry_supply")} empty="ยังไม่มีสต็อกในคลังนี้" />}
      </Panel>
    </section>
  );
}
