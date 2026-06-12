import { useState } from "react";
import { ProductVisual } from "../../components/ProductVisual";
import { OwnerBranchPicker } from "../../components/selects";
import { flushOutbox, queueStaffAction } from "../../db/syncEngine";
import { productById } from "../../domain/lookups";
import type { BranchId, FinishedLot, LocalState, Session } from "../../types";
import { todayBangkok } from "../../utils/ids";

interface WastagePageProps {
  state: LocalState;
  session: Session;
  refresh: () => Promise<void>;
  notify: (message: string, kind?: "success" | "error") => void;
}

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

export function WastagePage({ state, session, refresh, notify }: WastagePageProps) {
  const [ownerBranch, setOwnerBranch] = useState<BranchId>("BR-KASET");
  const branch_id = session.branch_id === "ALL" ? ownerBranch : session.branch_id;
  const [qtyByLot, setQtyByLot] = useState<Record<string, number>>({});
  const lots = state.finishedLots.filter((lot) => lot.branch_id === branch_id && lot.qty_remaining > 0 && productById(state, lot.product_id)?.is_perishable);

  function setQty(lotId: string, delta: number, max: number) {
    setQtyByLot((current) => ({ ...current, [lotId]: Math.max(1, Math.min(max, (current[lotId] || 1) + delta)) }));
  }

  async function createWastage(lot: FinishedLot) {
    const qty = qtyByLot[lot.lot_id] || 1;
    const product = productById(state, lot.product_id);
    if (!window.confirm(`ยืนยันทิ้ง "${product?.name_th}" จำนวน ${qty} ชิ้น? มูลค่าจะถูกบันทึกเป็นของเสีย`)) return;
    await queueStaffAction("wastage.create", { product_id: lot.product_id, qty, branch_id });
    await flushOutbox(session);
    notify(`บันทึกของเสีย ${qty} ชิ้นแล้ว`);
    setQtyByLot((current) => ({ ...current, [lot.lot_id]: 1 }));
    await refresh();
  }

  async function extend(lot: FinishedLot) {
    if (!window.confirm("ยืนยันเก็บขายต่อพรุ่งนี้ (เลื่อนวันหมดอายุ +1 วัน)?")) return;
    await queueStaffAction("stock.extendExpiry", { lot_id: lot.lot_id });
    await flushOutbox(session);
    notify("เลื่อนวันหมดอายุแล้ว");
    await refresh();
  }

  return (
    <section className="stack">
      {session.branch_id === "ALL" && <OwnerBranchPicker state={state} value={ownerBranch} onChange={setOwnerBranch} />}
      <div className="card-grid">
      {lots.length === 0 && <p className="empty">ไม่มีสินค้าที่ต้องตรวจของเสีย</p>}
      {lots.map((lot) => {
        const product = productById(state, lot.product_id);
        const qty = qtyByLot[lot.lot_id] || 1;
        return (
          <article className="work-card" key={lot.lot_id}>
            <ProductVisual product={product} />
            <h3>{product?.name_th}</h3>
            <p>คงเหลือ {lot.qty_remaining} · {expiryBadge(lot.expiry_date)}</p>
            <div className="qty-stepper">
              <button onClick={() => setQty(lot.lot_id, -1, lot.qty_remaining)}>-</button>
              <span>{qty}</span>
              <button onClick={() => setQty(lot.lot_id, 1, lot.qty_remaining)}>+</button>
            </div>
            <div className="button-row">
              <button className="danger" onClick={() => createWastage(lot)}>ทิ้ง {qty} ชิ้น</button>
              <button className="secondary" onClick={() => extend(lot)}>เก็บขายต่อ</button>
            </div>
          </article>
        );
      })}
      </div>
    </section>
  );
}
