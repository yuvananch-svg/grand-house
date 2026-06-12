import { Download, History, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Metric, Panel, SimpleTable } from "../../components/ui";
import { csvCell, safeParse, verifyChain } from "../../domain/audit";
import { auditFlagIncludes, bangkokDateFromIso, branchName } from "../../domain/lookups";
import type { BranchId, FeatureGroup, LocalState } from "../../types";

export function AuditPage({ state }: { state: LocalState }) {
  const [feature, setFeature] = useState<FeatureGroup | "ALL">("ALL");
  const [branch, setBranch] = useState<BranchId | "ALL">("ALL");
  const [user, setUser] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [onlySuspicious, setOnlySuspicious] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const chain = verifyChain(state.auditLog);
  const filtered = state.auditLog.filter((row) => {
    const date = bangkokDateFromIso(row.timestamp);
    return (feature === "ALL" || row.feature_group === feature)
      && (branch === "ALL" || row.branch_id === branch)
      && (!user.trim() || row.user_id.toLowerCase().includes(user.trim().toLowerCase()))
      && (!from || date >= from)
      && (!to || date <= to)
      && (!onlySuspicious || auditFlagIncludes(row.flag, "SUSPICIOUS"));
  });
  const rows = filtered.slice(-200).reverse();

  const summary = {
    priceOverride: state.auditLog.filter((row) => auditFlagIncludes(row.flag, "PRICE_OVERRIDE") || row.action === "PRICE_CHANGE" || row.action === "PRICE_OVERRIDE").length,
    stockAdjust: state.auditLog.filter((row) => row.action === "STOCK_ADJUST").length,
    suspicious: state.auditLog.filter((row) => auditFlagIncludes(row.flag, "SUSPICIOUS")).length,
    failedAuth: state.auditLog.filter((row) => row.action === "LOGIN_FAILED" || row.action === "FORBIDDEN_ATTEMPT" || row.action === "PIN_FAILED").length,
    mismatch: state.reconciliations.filter((row) => row.status === "mismatch" || row.status === "reopened").length
  };

  function exportCsv() {
    const headers = ["timestamp", "user_id", "role", "branch_id", "feature_group", "action", "ref_id", "flag", "success", "row_hash"];
    const lines = [headers.join(",")].concat(filtered.map((row) =>
      headers.map((h) => csvCell((row as unknown as Record<string, unknown>)[h])).join(",")
    ));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "grands-house-audit.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return <section className="stack">
    <Panel title="สรุปภาพรวมการตรวจสอบ" icon={ShieldAlert}>
      <div className="metric-grid">
        <Metric label="การแก้ราคา" value={String(summary.priceOverride)} />
        <Metric label="ปรับสต็อก" value={String(summary.stockAdjust)} />
        <Metric label="รายการน่าสงสัย" value={String(summary.suspicious)} />
        <Metric label="ล็อกอิน/สิทธิ์ล้มเหลว" value={String(summary.failedAuth)} />
        <Metric label="ยอดไม่ตรง/เปิดใหม่" value={String(summary.mismatch)} />
        <Metric label="สถานะ Hash chain" value={chain.ok ? `✓ ต่อเนื่อง ${state.auditLog.length} รายการล่าสุด` : `✗ ขาดที่ ${chain.brokenAt}`} />
      </div>
      <p className="muted-text">หน้าจอนี้ตรวจความต่อเนื่องของรายการ audit ที่โหลดมา ส่วนการตรวจโซ่ทั้งเส้นให้ trigger กลางคืนรับผิดชอบ</p>
    </Panel>
    <Panel title="ตัวกรองประวัติ" icon={History}>
      <div className="filter-row">
        <select value={feature} onChange={(event) => setFeature(event.target.value as FeatureGroup | "ALL")}>
          <option value="ALL">ทุกฟีเจอร์</option>
          {(["pos", "wastage", "inventory", "production", "reconcile", "expense", "admin", "auth", "report"] as FeatureGroup[]).map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={branch} onChange={(event) => setBranch(event.target.value as BranchId | "ALL")}>
          <option value="ALL">ทุกสาขา</option>
          {state.branches.map((item) => <option key={item.branch_id} value={item.branch_id}>{item.branch_name}</option>)}
        </select>
        <input placeholder="พนักงาน (user_id)" value={user} onChange={(event) => setUser(event.target.value)} />
        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <label className="checkbox-row"><input type="checkbox" checked={onlySuspicious} onChange={(event) => setOnlySuspicious(event.target.checked)} /><span>เฉพาะน่าสงสัย</span></label>
        <button className="ghost" onClick={exportCsv}><Download size={16} /> Export CSV</button>
      </div>
      <SimpleTable
        headers={["เวลา", "ผู้ใช้", "สาขา", "ฟีเจอร์", "Action", "Ref", "Flag", "รายละเอียด"]}
        rows={rows.map((row) => [
          row.timestamp.slice(0, 19),
          row.user_id,
          branchName(state, row.branch_id),
          row.feature_group,
          row.action,
          row.ref_id,
          row.flag ? <span key={row.id} className={`badge ${auditFlagIncludes(row.flag, "SUSPICIOUS") ? "red" : "amber"}`}>{row.flag}</span> : "-",
          <button key={`${row.id}-d`} className="ghost" onClick={() => setExpanded(expanded === row.id ? null : row.id)}>{expanded === row.id ? "ซ่อน" : "ดู"}</button>
        ])}
        empty="ไม่มีรายการตามตัวกรอง"
      />
      {expanded && (() => {
        const row = state.auditLog.find((item) => item.id === expanded);
        return row ? <pre className="debug-box">{JSON.stringify({ action: row.action, detail: safeParse(row.detail), prev_hash: row.prev_hash, row_hash: row.row_hash }, null, 2)}</pre> : null;
      })()}
    </Panel>
  </section>;
}
