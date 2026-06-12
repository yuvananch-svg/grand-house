import { AlertTriangle, Calculator, Save } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { callApi } from "../../api/client";
import { FormPanel, Input, Panel, SimpleTable } from "../../components/ui";
import { auditFlagIncludes, paymentLabel } from "../../domain/lookups";
import { paymentMethods } from "../../domain/reporting";
import type { BranchId, LocalState, PaymentMethod, Session } from "../../types";
import { todayBangkok } from "../../utils/ids";
import { bahtToSatang, formatMoney, satangToBaht } from "../../utils/money";

interface ReconcilePageProps {
  state: LocalState;
  session: Session;
  refresh: () => Promise<void>;
  notify: (message: string, kind?: "success" | "error") => void;
}

export function ReconcilePage({ state, session, refresh, notify }: ReconcilePageProps) {
  const [branch, setBranch] = useState<BranchId>("BR-KASET");
  const [date, setDate] = useState(todayBangkok());
  const system = paymentMethods.reduce((acc, method) => {
    acc[method] = state.sales.filter((sale) => sale.branch_id === branch && sale.business_date === date && sale.payment_method === method && sale.status === "active").reduce((sum, sale) => sum + sale.total_amount, 0);
    return acc;
  }, {} as Record<PaymentMethod, number>);
  const existing = state.reconciliations.find((item) => item.branch_id === branch && item.business_date === date);
  const voidedBills = state.sales.filter((sale) => sale.branch_id === branch && sale.business_date === date && sale.status === "voided");
  const oversoldIds = new Set(state.auditLog.filter((row) => auditFlagIncludes(row.flag, "OVERSOLD") && row.action === "SALE_CREATE").map((row) => row.ref_id));
  const oversoldBills = state.sales.filter((sale) => sale.branch_id === branch && sale.business_date === date && oversoldIds.has(sale.id));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const actual = paymentMethods.reduce((acc, method) => ({ ...acc, [method]: bahtToSatang(String(form.get(method))) }), {} as Record<PaymentMethod, number>);
    const response = await callApi("reconcile.confirm", { branch_id: branch, business_date: date, actual, note: String(form.get("note")) }, session);
    notify(response.ok ? "บันทึก reconciliation แล้ว" : response.message, response.ok ? "success" : "error");
    await refresh();
  }

  return <section className="stack">
    <Panel title="ยอดระบบ" icon={Calculator}>
      <div className="filter-row">
        <select value={branch} onChange={(event) => setBranch(event.target.value as BranchId)}>{state.branches.map((item) => <option key={item.branch_id} value={item.branch_id}>{item.branch_name}</option>)}</select>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>
      {existing && <p className={existing.status === "reopened" ? "danger-text" : "good-text"}>สถานะปิดบัญชีวันนี้: {existing.status}</p>}
      <SimpleTable headers={["ช่องทาง", "ยอดระบบ"]} rows={paymentMethods.map((method) => [paymentLabel(method), formatMoney(system[method])])} />
    </Panel>
    {(voidedBills.length > 0 || oversoldBills.length > 0) && (
      <Panel title="บิลที่ต้องตรวจเพิ่ม (ยกเลิก / ขายเกินสต็อก)" icon={AlertTriangle}>
        <SimpleTable headers={["เลขบิล", "ประเภทเหตุการณ์", "ยอด", "เหตุผล/หมายเหตุ"]} rows={[
          ...voidedBills.map((sale) => [sale.id, <span key={`${sale.id}-v`} className="badge amber">ยกเลิก</span>, formatMoney(sale.total_amount), sale.void_reason || "-"]),
          ...oversoldBills.map((sale) => [sale.id, <span key={`${sale.id}-o`} className="badge red">ขายเกินสต็อก</span>, formatMoney(sale.total_amount), "ตรวจสต็อกจริง"])
        ]} />
      </Panel>
    )}
    <FormPanel key={`${branch}-${date}`} title="คีย์ยอดจริง" icon={Save} onSubmit={submit}>
      {paymentMethods.map((method) => <Input key={method} name={method} label={`ยอดจริง ${paymentLabel(method)} (บาท)`} type="number" step="0.01" defaultValue={String(satangToBaht(system[method]))} />)}
      <Input name="note" label="หมายเหตุเมื่อยอดไม่ตรง" />
    </FormPanel>
  </section>;
}
