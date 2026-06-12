import { AlertTriangle, ClipboardCheck, RotateCcw } from "lucide-react";
import { useState } from "react";
import { OwnerBranchPicker } from "../../components/selects";
import { Metric, Panel, SimpleTable } from "../../components/ui";
import { flushOutbox } from "../../db/syncEngine";
import { paymentLabel } from "../../domain/lookups";
import { paymentMethods } from "../../domain/reporting";
import type { BranchId, LocalState, Session } from "../../types";
import { todayBangkok } from "../../utils/ids";
import { formatMoney } from "../../utils/money";

interface DayClosePageProps {
  state: LocalState;
  session: Session;
  refresh: () => Promise<void>;
  notify: (message: string, kind?: "success" | "error") => void;
  outboxCount: number;
}

export function DayClosePage({ state, session, refresh, notify, outboxCount }: DayClosePageProps) {
  const [ownerBranch, setOwnerBranch] = useState<BranchId>("BR-KASET");
  const branch_id = session.branch_id === "ALL" ? ownerBranch : session.branch_id;
  const today = todayBangkok();
  const sales = state.sales.filter((sale) => sale.branch_id === branch_id && sale.business_date === today && sale.status === "active");
  const byPayment = paymentMethods.map((method) => ({
    method,
    amount: sales.filter((sale) => sale.payment_method === method).reduce((sum, sale) => sum + sale.total_amount, 0)
  }));
  const cash = byPayment.find((row) => row.method === "CASH")?.amount || 0;

  async function retrySync() {
    const result = await flushOutbox(session);
    notify(result.failed ? `ส่งสำเร็จ ${result.sent} รายการ, ยังมีปัญหา ${result.failed} รายการ` : `ส่งสำเร็จ ${result.sent} รายการ`, result.failed ? "error" : "success");
    await refresh();
  }

  return (
    <section className="stack">
      {session.branch_id === "ALL" && <OwnerBranchPicker state={state} value={ownerBranch} onChange={setOwnerBranch} />}
      {outboxCount > 0 && (
        <Panel title="ยังปิดร้านไม่ได้" icon={AlertTriangle}>
          <p className="danger-text">ยังมีรายการรอส่ง {outboxCount} รายการ ต้องส่งให้หมดก่อนใช้ยอดปิดร้านจริง</p>
          <button className="primary" onClick={retrySync}><RotateCcw size={18} /> ลองส่งอีกครั้ง</button>
        </Panel>
      )}
      <div className="metric-grid">
        <Metric label="จำนวนบิลวันนี้" value={`${sales.length} บิล`} />
        <Metric label="ยอดรวม" value={`${formatMoney(sales.reduce((sum, sale) => sum + sale.total_amount, 0))} บาท`} />
        <Metric label="เงินสดที่ควรมีในเก๊ะ" value={`${formatMoney(cash)} บาท`} />
      </div>
      <Panel title="ยอดแยกช่องทาง" icon={ClipboardCheck}>
        <SimpleTable headers={["ช่องทาง", "ยอด"]} rows={byPayment.map((row) => [paymentLabel(row.method), formatMoney(row.amount)])} />
      </Panel>
    </section>
  );
}
