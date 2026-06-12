import { AlertTriangle, BarChart3 } from "lucide-react";
import { useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Metric, Panel, SimpleTable } from "../../components/ui";
import { auditFlagIncludes } from "../../domain/lookups";
import { resolveDateRange, summarize, type RangePreset } from "../../domain/reporting";
import type { BranchId, LocalState } from "../../types";
import { formatMoney } from "../../utils/money";

export function DashboardPage({ state }: { state: LocalState }) {
  const [branch, setBranch] = useState<BranchId | "ALL">("ALL");
  const [range, setRange] = useState<RangePreset>("today");
  const dateRange = resolveDateRange(range);
  const summary = summarize(state, { branch, date_from: dateRange.date_from, date_to: dateRange.date_to });
  return <section className="stack">
    <Panel title="ตัวกรอง Dashboard" icon={BarChart3}>
      <div className="filter-row">
        <select value={branch} onChange={(event) => setBranch(event.target.value as BranchId | "ALL")}>
          <option value="ALL">ทุกสาขา</option>
          {state.branches.map((item) => <option key={item.branch_id} value={item.branch_id}>{item.branch_name}</option>)}
        </select>
        <select value={range} onChange={(event) => setRange(event.target.value as RangePreset)}>
          <option value="today">รายวัน</option>
          <option value="month">รายเดือน</option>
          <option value="quarter">รายไตรมาส</option>
          <option value="year">รายปี</option>
          <option value="inception">ตั้งแต่เริ่ม</option>
        </select>
      </div>
    </Panel>
    <div className="metric-grid">
      <Metric label="ยอดขายรวม" value={`${formatMoney(summary.gross_revenue)} บาท`} />
      <Metric label="COGS" value={`${formatMoney(summary.cogs)} บาท`} />
      <Metric label="กำไรขั้นต้น" value={`${formatMoney(summary.gross_profit)} บาท`} />
      <Metric label="มูลค่าของเสีย" value={`${formatMoney(summary.wastage_value)} บาท`} />
      <Metric label="ค่าใช้จ่าย" value={`${formatMoney(summary.total_expenses)} บาท`} />
      <Metric label="กำไรสุทธิ" value={`${formatMoney(summary.net_profit)} บาท`} />
    </div>
    <Panel title="Daily trend" icon={BarChart3}>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={summary.daily_trend}>
            <XAxis dataKey="date" />
            <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} width={54} />
            <Tooltip formatter={(value) => formatMoney(Number(value))} />
            <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#0f766e" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="profit" name="Profit" stroke="#7c3aed" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
    <Panel title="Alert board" icon={AlertTriangle}>
      <SimpleTable headers={["เรื่อง", "จำนวน"]} rows={[
        ["Reconcile mismatch/reopened", String(state.reconciliations.filter((item) => item.status === "mismatch" || item.status === "reopened").length)],
        ["Audit suspicious", String(state.auditLog.filter((item) => auditFlagIncludes(item.flag, "SUSPICIOUS")).length)],
        ["Client errors", String(state.errorLog.length)]
      ]} />
    </Panel>
  </section>;
}
