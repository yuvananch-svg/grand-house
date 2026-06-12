import { History, Landmark, WalletCards } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { callApi } from "../../api/client";
import { BranchSelect } from "../../components/selects";
import { FormPanel, Input, Panel, SimpleTable } from "../../components/ui";
import { branchName, paymentLabel } from "../../domain/lookups";
import { paymentMethods } from "../../domain/reporting";
import type { Expense, LocalState, Session } from "../../types";
import { monthBangkok, todayBangkok } from "../../utils/ids";
import { bahtToSatang, formatMoney } from "../../utils/money";

interface ExpensesPageProps {
  state: LocalState;
  session: Session;
  refresh: () => Promise<void>;
  notify: (message: string, kind?: "success" | "error") => void;
}

export function ExpensesPage({ state, session, refresh, notify }: ExpensesPageProps) {
  const [tab, setTab] = useState<"general" | "stockBuy">("general");

  async function submitGeneral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const response = await callApi("expense.create", {
      branch_id: form.get("branch_id"),
      expense_type: form.get("expense_type"),
      amount: bahtToSatang(String(form.get("amount"))),
      expense_month: form.get("expense_month"),
      note: form.get("note"),
      payment_channel: form.get("payment_channel")
    }, session);
    notify(response.ok ? "บันทึกค่าใช้จ่ายแล้ว" : response.message, response.ok ? "success" : "error");
    if (response.ok) formEl.reset();
    await refresh();
  }

  async function submitStockBuy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const material = state.rawMaterials.find((item) => item.id === form.get("material_id"));
    const qty = Math.round(Number(form.get("qty_display")) * (material?.display_factor || 1));
    const response = await callApi("rawlot.purchase", {
      branch_id: form.get("branch_id"),
      material_id: form.get("material_id"),
      qty,
      total_cost: bahtToSatang(String(form.get("total_cost"))),
      supplier_note: String(form.get("supplier_note")),
      purchase_date: String(form.get("purchase_date")),
      payment_channel: form.get("payment_channel"),
      as_expense: true
    }, session);
    notify(response.ok ? "ซื้อเข้าคลัง + บันทึกค่าใช้จ่ายแล้ว" : response.message, response.ok ? "success" : "error");
    if (response.ok) formEl.reset();
    await refresh();
  }

  return <section className="stack">
    <div className="segmented">
      <button className={tab === "general" ? "active" : ""} onClick={() => setTab("general")}>ค่าใช้จ่ายทั่วไป</button>
      <button className={tab === "stockBuy" ? "active" : ""} onClick={() => setTab("stockBuy")}>ซื้อเข้าคลัง</button>
    </div>
    {tab === "general" ? (
      <FormPanel title="ค่าใช้จ่าย" icon={WalletCards} onSubmit={submitGeneral}>
        <BranchSelect state={state} />
        <label><span>ประเภท</span><select name="expense_type">{(["salary", "utility_water", "utility_electric", "maintenance", "supply_purchase", "other"] as Expense["expense_type"][]).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <Input name="amount" label="จำนวนเงิน (บาท)" type="number" step="0.01" defaultValue="100" />
        <PaymentChannelSelect />
        <Input name="expense_month" label="เดือนค่าใช้จ่าย" type="month" defaultValue={monthBangkok()} />
        <Input name="note" label="หมายเหตุ" defaultValue="local expense" />
      </FormPanel>
    ) : (
      <FormPanel title="ซื้อวัตถุดิบ/บรรจุภัณฑ์เข้าคลัง (สร้างล็อต + ค่าใช้จ่ายในคลิกเดียว)" icon={Landmark} onSubmit={submitStockBuy}>
        <BranchSelect state={state} />
        <label><span>วัตถุดิบ/บรรจุภัณฑ์</span><select name="material_id">{state.rawMaterials.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name_th} [{item.item_code}] ({item.display_unit})</option>)}</select></label>
        <Input name="qty_display" label="จำนวนตามหน่วยแสดงผล" type="number" step="0.001" defaultValue="1" />
        <Input name="total_cost" label="ราคารวม (บาท)" type="number" step="0.01" defaultValue="100" />
        <PaymentChannelSelect />
        <Input name="supplier_note" label="ซัพพลายเออร์/หมายเหตุ" defaultValue="ซื้อเข้าคลัง" />
        <Input name="purchase_date" label="วันที่ซื้อ" type="date" defaultValue={todayBangkok()} />
      </FormPanel>
    )}
    <Panel title="รายการค่าใช้จ่าย" icon={History}>
      <SimpleTable headers={["เดือน", "สาขา", "ประเภท", "จำนวน", "ช่องทาง", "รหัสของ", "อ้างอิงล็อต", "หมายเหตุ"]} rows={state.expenses.slice().reverse().map((item) => [
        item.expense_month,
        branchName(state, item.branch_id),
        item.expense_type,
        formatMoney(item.amount),
        item.payment_channel ? paymentLabel(item.payment_channel) : "-",
        item.item_code || "-",
        item.ref_id || "-",
        item.note
      ])} />
    </Panel>
  </section>;
}

function PaymentChannelSelect() {
  return <label><span>ช่องทางจ่าย</span><select name="payment_channel">{paymentMethods.map((method) => <option key={method} value={method}>{paymentLabel(method)}</option>)}</select></label>;
}
