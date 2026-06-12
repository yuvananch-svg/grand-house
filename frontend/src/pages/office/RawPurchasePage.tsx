import { Landmark } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { callApi } from "../../api/client";
import { BranchSelect } from "../../components/selects";
import { FormPanel, Input } from "../../components/ui";
import type { LocalState, Session } from "../../types";
import { todayBangkok } from "../../utils/ids";
import { bahtToSatang } from "../../utils/money";

interface RawPurchasePageProps {
  state: LocalState;
  session: Session;
  refresh: () => Promise<void>;
  notify: (message: string, kind?: "success" | "error") => void;
}

export function RawPurchasePage({ state, session, refresh, notify }: RawPurchasePageProps) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const material = state.rawMaterials.find((item) => item.id === form.get("material_id"));
    if (!material) {
      notify("เลือกวัตถุดิบ/บรรจุภัณฑ์ก่อนบันทึก", "error");
      return;
    }
    const qty = Math.round(Number(form.get("qty_display")) * (material.display_factor || 1));
    const response = await callApi("rawlot.purchase", {
      branch_id: form.get("branch_id"),
      material_id: form.get("material_id"),
      qty,
      total_cost: bahtToSatang(String(form.get("total_cost"))),
      supplier_note: String(form.get("supplier_note")),
      purchase_date: String(form.get("purchase_date"))
    }, session);
    notify(response.ok ? "ซื้อวัตถุดิบเข้าล็อตแล้ว" : response.message, response.ok ? "success" : "error");
    if (response.ok) formEl.reset();
    await refresh();
  }

  const activeMaterials = state.rawMaterials.filter((item) => item.active);
  const [materialId, setMaterialId] = useState(activeMaterials[0]?.id || "");
  const [qtyDisplay, setQtyDisplay] = useState("1");
  const material = state.rawMaterials.find((item) => item.id === materialId);
  const baseQty = Math.round(Number(qtyDisplay || 0) * (material?.display_factor || 1));

  return <FormPanel title="ซื้อวัตถุดิบเข้าล็อต" icon={Landmark} onSubmit={submit}>
    <BranchSelect state={state} />
    <label><span>วัตถุดิบ/บรรจุภัณฑ์</span><select name="material_id" value={materialId} onChange={(event) => setMaterialId(event.target.value)}>{activeMaterials.map((item) => <option key={item.id} value={item.id}>{item.name_th} [{item.item_code}] ({item.display_unit})</option>)}</select></label>
    <label><span>จำนวนตามหน่วยแสดงผล</span><input name="qty_display" type="number" step="0.001" value={qtyDisplay} onChange={(event) => setQtyDisplay(event.target.value)} /><span className="unit-hint">= {baseQty.toLocaleString()} {material?.base_unit}</span></label>
    <Input name="total_cost" label="ราคารวมล็อต (บาท)" type="number" step="0.01" defaultValue="100" />
    <Input name="supplier_note" label="ซัพพลายเออร์/หมายเหตุ" defaultValue="ซื้อเข้า local" />
    <Input name="purchase_date" label="วันที่ซื้อ" type="date" defaultValue={todayBangkok()} />
  </FormPanel>;
}
