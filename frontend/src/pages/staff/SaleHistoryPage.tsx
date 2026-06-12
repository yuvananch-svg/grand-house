import { AlertTriangle, History, ReceiptText } from "lucide-react";
import { useEffect, useState } from "react";
import { callApi } from "../../api/client";
import { OwnerBranchPicker } from "../../components/selects";
import { Panel, SimpleTable } from "../../components/ui";
import { listOutbox, removeQueuedLocalSale } from "../../db/syncEngine";
import { branchName, paymentLabel } from "../../domain/lookups";
import type { BranchId, LocalState, Session } from "../../types";
import { todayBangkok } from "../../utils/ids";
import { formatMoney } from "../../utils/money";

const voidReasons = ["จิ้มผิด", "ลูกค้าคืนสินค้า", "ทดสอบระบบ", "อื่นๆ"];

interface SaleHistoryPageProps {
  state: LocalState;
  session: Session;
  refresh: () => Promise<void>;
  notify: (message: string, kind?: "success" | "error") => void;
  outboxCount: number;
}

export function SaleHistoryPage({ state, session, refresh, notify, outboxCount }: SaleHistoryPageProps) {
  const [queued, setQueued] = useState<{ id: string; status: string; error?: string }[]>([]);
  const [voidTarget, setVoidTarget] = useState<string | null>(null);
  const [ownerBranch, setOwnerBranch] = useState<BranchId>("BR-KASET");
  const branch_id = session.branch_id === "ALL" ? ownerBranch : session.branch_id;
  const today = todayBangkok();
  const sales = state.sales
    .filter((sale) => (session.role === "staff" ? sale.branch_id === branch_id && sale.device_id === session.device_id && sale.business_date === today : sale.branch_id === branch_id))
    .slice(-40)
    .reverse();
  const windowMinutes = state.config.void_window_minutes;

  useEffect(() => {
    void listOutbox().then((items) => {
      const rows = items.flatMap((item) => {
        const payload = item.payload as { sales?: { id: string }[] };
        return payload.sales?.map((sale) => ({ id: sale.id, status: item.status, error: item.last_error })) || [];
      });
      setQueued(rows);
    });
  }, [outboxCount]);

  function voidable(sale: LocalState["sales"][number]): boolean {
    if (sale.status === "voided" || sale.reconcile_status === "reconciled") return false;
    if (session.role === "staff") {
      const ageMin = (Date.now() - Date.parse(sale.server_received_at || sale.client_created_at)) / 60_000;
      return sale.user_id === session.user_id && ageMin <= windowMinutes;
    }
    return true;
  }

  async function voidSale(saleId: string, reason: string) {
    setVoidTarget(null);
    const removed = await removeQueuedLocalSale(saleId);
    if (removed) {
      notify("ลบบิลที่ยังไม่ sync แล้ว");
      await refresh();
      return;
    }
    const response = await callApi("sale.void", { sale_id: saleId, reason }, session);
    notify(response.ok ? "ยกเลิกบิลแล้ว" : response.message, response.ok ? "success" : "error");
    await refresh();
  }

  return (
    <section className="stack">
      {session.branch_id === "ALL" && <OwnerBranchPicker state={state} value={ownerBranch} onChange={setOwnerBranch} />}
      <Panel title="บิลที่อยู่ในเครื่อง" icon={ReceiptText}>
        <SimpleTable headers={["เลขบิล", "สถานะ", "รายละเอียด"]} rows={queued.map((item) => [item.id, item.status === "dead" ? "ส่งไม่ผ่านถาวร" : "รอ sync", item.error || "-"])} empty="ไม่มีบิลค้างใน outbox" />
      </Panel>
      {voidTarget && (
        <Panel title="เลือกเหตุผลการยกเลิกบิล" icon={AlertTriangle}>
          <div className="button-row">
            {voidReasons.map((reason) => <button key={reason} className="secondary" onClick={() => voidSale(voidTarget, reason)}>{reason}</button>)}
            <button className="ghost" onClick={() => setVoidTarget(null)}>ปิด</button>
          </div>
        </Panel>
      )}
      <Panel title="บิลที่ sync แล้ว" icon={History}>
        <SimpleTable
          headers={["เวลา", "สาขา", "ประเภท", "ช่องทาง", "ยอด", "สถานะ", "จัดการ"]}
          rows={sales.map((sale) => [
            sale.client_created_at.slice(11, 16),
            branchName(state, sale.branch_id),
            sale.sale_type,
            paymentLabel(sale.payment_method),
            formatMoney(sale.total_amount),
            sale.status === "voided" ? `ยกเลิก (${sale.void_reason || "-"})` : sale.reconcile_status,
            voidable(sale)
              ? <button key={sale.id} className="danger" onClick={() => setVoidTarget(sale.id)}>Void</button>
              : <span key={sale.id} className="muted-text">-</span>
          ])}
        />
      </Panel>
    </section>
  );
}
