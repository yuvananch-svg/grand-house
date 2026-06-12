import { BarChart3 } from "lucide-react";
import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Panel, SimpleTable } from "../../components/ui";
import { countSales, countWastage, resolveDateRange, summarize, type RangePreset } from "../../domain/reporting";
import type { BranchId, LocalState } from "../../types";
import { formatMoney } from "../../utils/money";

export function RevenuePage({ state }: { state: LocalState }) {
  const [branch, setBranch] = useState<BranchId | "ALL">("ALL");
  const [range, setRange] = useState<RangePreset>("month");
  const dateRange = resolveDateRange(range);
  const summary = summarize(state, { branch, ...dateRange });
  const customer = summary.revenue_by_type.normal + summary.revenue_by_type.discount + summary.revenue_by_type.freebie;
  const staff = summary.revenue_by_type.staff;
  const customerStaffData = [{ name: "ลูกค้าทั่วไป", value: customer }, { name: "พนักงาน", value: staff }];
  const totalBase = summary.gross_revenue + summary.wastage_value;
  const typeData = [
    { key: "normal", name: "ขายปกติ", value: summary.revenue_by_type.normal, count: countSales(state, branch, dateRange, "normal"), color: "#0f766e" },
    { key: "discount", name: "ลดราคา", value: summary.revenue_by_type.discount, count: countSales(state, branch, dateRange, "discount"), color: "#d97706" },
    { key: "freebie", name: "สินค้าแถม", value: summary.revenue_by_type.freebie, count: countSales(state, branch, dateRange, "freebie"), color: "#0284c7" },
    { key: "staff", name: "ขายพนักงาน", value: summary.revenue_by_type.staff, count: countSales(state, branch, dateRange, "staff"), color: "#7c3aed" },
    { key: "wastage", name: "ของเสีย (ต้นทุนสูญ)", value: summary.wastage_value, count: countWastage(state, branch, dateRange), color: "#dc2626" }
  ];
  const branchRows = state.branches.map((branchRow) => {
    const branchSummary = summarize(state, { branch: branchRow.branch_id, ...dateRange });
    return [
      branchRow.branch_name,
      formatMoney(branchSummary.revenue_by_type.normal),
      formatMoney(branchSummary.revenue_by_type.discount),
      formatMoney(branchSummary.revenue_by_type.freebie),
      formatMoney(branchSummary.revenue_by_type.staff),
      formatMoney(branchSummary.wastage_value)
    ];
  });
  return <section className="stack">
    <Panel title="ตัวกรอง" icon={BarChart3}>
      <div className="filter-row">
        <select value={branch} onChange={(event) => setBranch(event.target.value as BranchId | "ALL")}>
          <option value="ALL">ทุกสาขา</option>
          {state.branches.map((item) => <option key={item.branch_id} value={item.branch_id}>{item.branch_name}</option>)}
        </select>
        <select value={range} onChange={(event) => setRange(event.target.value as RangePreset)}>
          <option value="today">วันนี้</option>
          <option value="month">เดือนนี้</option>
          <option value="quarter">ไตรมาสนี้</option>
          <option value="year">ปีนี้</option>
          <option value="inception">ตั้งแต่เริ่มระบบ</option>
        </select>
      </div>
    </Panel>
    <Panel title="สัดส่วน 5 ประเภท" icon={BarChart3}>
      <p className="muted-text">4 รายการแรกคือรายได้ ส่วนของเสียคือต้นทุนที่สูญ คิด % จากฐานรายได้รวม + มูลค่าของเสีย</p>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={typeData} dataKey="value" nameKey="name" outerRadius={100} label>
              {typeData.map((row) => <Cell key={row.key} fill={row.color} />)}
            </Pie>
            <Tooltip formatter={(value) => formatMoney(Number(value))} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <SimpleTable headers={["ประเภท", "ยอดบาท", "จำนวน", "%"]} rows={typeData.map((row) => [
        row.name,
        formatMoney(row.value),
        String(row.count),
        `${totalBase ? Math.round((row.value / totalBase) * 100) : 0}%`
      ])} />
    </Panel>
    <Panel title="สัดส่วนรายได้ลูกค้าจริง vs พนักงาน" icon={BarChart3}>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={customerStaffData} dataKey="value" nameKey="name" outerRadius={100} label>
              <Cell fill="#0f766e" />
              <Cell fill="#7c3aed" />
            </Pie>
            <Tooltip formatter={(value) => formatMoney(Number(value))} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <SimpleTable headers={["กลุ่ม", "ยอด", "%"]} rows={customerStaffData.map((row) => [row.name, formatMoney(row.value), `${summary.gross_revenue ? Math.round((row.value / summary.gross_revenue) * 100) : 0}%`])} />
    </Panel>
    <Panel title="เทียบรายสาขา" icon={BarChart3}>
      <SimpleTable headers={["สาขา", "ขายปกติ", "ลดราคา", "สินค้าแถม", "ขายพนักงาน", "ของเสีย"]} rows={branchRows} />
    </Panel>
  </section>;
}
