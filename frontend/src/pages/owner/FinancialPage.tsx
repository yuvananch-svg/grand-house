import { Download, FileText } from "lucide-react";
import { Panel, SimpleTable } from "../../components/ui";
import { summarize } from "../../domain/reporting";
import type { LocalState } from "../../types";
import { formatMoney } from "../../utils/money";

type PdfMakeInstance = {
  vfs?: Record<string, string>;
  createPdf: (definition: unknown) => { download: (fileName: string) => void };
};

export function FinancialPage({ state, notify }: { state: LocalState; notify: (message: string) => void }) {
  const summary = summarize(state);
  const inventoryValue =
    state.finishedLots.reduce((sum, lot) => sum + lot.qty_remaining * lot.unit_cost, 0) +
    state.rawLots.reduce((sum, lot) => sum + lot.qty_remaining * lot.unit_cost, 0);
  const ownerEquity = summary.net_profit + inventoryValue;

  async function exportPdf() {
    const [{ default: pdfMake }, { sarabunRegular, sarabunBold }] = await Promise.all([
      import("pdfmake/build/pdfmake"),
      import("../../fonts/sarabun")
    ]);
    const pdf = pdfMake as PdfMakeInstance & { fonts?: Record<string, unknown> };
    pdf.vfs = { "Sarabun-Regular.ttf": sarabunRegular, "Sarabun-Bold.ttf": sarabunBold };
    pdf.fonts = { Sarabun: { normal: "Sarabun-Regular.ttf", bold: "Sarabun-Bold.ttf", italics: "Sarabun-Regular.ttf", bolditalics: "Sarabun-Bold.ttf" } };

    const moneyRow = (label: string, value: number, bold = false) => [
      { text: label, bold },
      { text: `${formatMoney(value)} บาท`, alignment: "right", bold }
    ];
    const branchPerf = state.branches.map((branch) => {
      const s = summarize(state, { branch: branch.branch_id });
      return [branch.branch_name, `${formatMoney(s.gross_revenue)}`, `${formatMoney(s.cogs)}`, `${formatMoney(s.net_profit)}`];
    });

    pdf
      .createPdf({
        pageSize: "A4",
        pageMargins: [40, 70, 40, 50],
        header: { text: "Grand's House — งบการเงิน (สังกัด The Grand's)", alignment: "center", margin: [0, 24, 0, 0], color: "#0f766e", bold: true },
        footer: (currentPage: number, pageCount: number) => ({ text: `หน้า ${currentPage}/${pageCount}`, alignment: "center", margin: [0, 16, 0, 0], fontSize: 9, color: "#64748b" }),
        content: [
          { text: "รายงานทางการเงินรูปแบบ 10-K / 10-Q", style: "title" },
          { text: `จัดทำเมื่อ ${new Date().toLocaleString("th-TH")}`, style: "muted", margin: [0, 0, 0, 16] },

          { text: "Part I — ภาพรวมธุรกิจ", style: "part" },
          { text: "Grand's House เป็นบริษัทลูกของ The Grand's ดำเนินกิจการร้านอาหาร 3 สาขา (เกษตรใหม่ ท่ารั้ว บ้านโจ้) จำหน่ายข้าวกล่อง อาหารเช้า เครื่องดื่ม และของขบเคี้ยว", margin: [0, 0, 0, 16] },

          { text: "Part II — ผลประกอบการรายสาขา", style: "part" },
          { table: { widths: ["*", "auto", "auto", "auto"], body: [
            [{ text: "สาขา", bold: true }, { text: "รายได้", bold: true, alignment: "right" }, { text: "ต้นทุน", bold: true, alignment: "right" }, { text: "กำไรสุทธิ", bold: true, alignment: "right" }],
            ...branchPerf.map((row) => [row[0], { text: row[1], alignment: "right" }, { text: row[2], alignment: "right" }, { text: row[3], alignment: "right" }])
          ] }, layout: "lightHorizontalLines", margin: [0, 0, 0, 16] },

          { text: "Part III — งบการเงิน", style: "part" },
          { text: "งบกำไรขาดทุน (Income Statement)", style: "subhead" },
          { table: { widths: ["*", "auto"], body: [
            moneyRow("รายได้รวม (Gross Revenue)", summary.gross_revenue),
            moneyRow("ต้นทุนขาย (COGS)", summary.cogs),
            moneyRow("กำไรขั้นต้น (Gross Profit)", summary.gross_profit, true),
            moneyRow("มูลค่าของเสีย (Wastage)", summary.wastage_value),
            moneyRow("ค่าใช้จ่ายดำเนินงาน (Operating Expenses)", summary.total_expenses),
            moneyRow("กำไรสุทธิ (Net Income)", summary.net_profit, true)
          ] }, layout: "lightHorizontalLines", margin: [0, 0, 0, 16] },
          { text: "งบดุล (Balance Sheet)", style: "subhead" },
          { table: { widths: ["*", "auto"], body: [
            moneyRow("สินทรัพย์: มูลค่าสต็อกคงเหลือ", inventoryValue),
            moneyRow("สินทรัพย์: เงินสด/ธนาคาร (proxy)", summary.gross_revenue),
            moneyRow("ส่วนของเจ้าของ (Owner's Equity)", ownerEquity, true)
          ] }, layout: "lightHorizontalLines" }
        ],
        styles: {
          title: { fontSize: 18, bold: true, margin: [0, 0, 0, 4] },
          part: { fontSize: 14, bold: true, color: "#0f766e", margin: [0, 8, 0, 8] },
          subhead: { fontSize: 12, bold: true, margin: [0, 4, 0, 6] },
          muted: { fontSize: 9, color: "#64748b" }
        },
        defaultStyle: { font: "Sarabun", fontSize: 11 }
      })
      .download("grands-house-financial.pdf");
    notify("สั่ง Export PDF (ฟอนต์ไทย Sarabun) แล้ว");
  }

  return <section className="stack">
    <Panel title="งบการเงิน 10-K/10-Q (ฟอนต์ไทย Sarabun)" icon={FileText}>
      <button className="primary" onClick={exportPdf}><Download size={18} /> Export to PDF</button>
      <SimpleTable headers={["หัวข้อ", "จำนวน"]} rows={[
        ["รายได้รวม (Gross Revenue)", formatMoney(summary.gross_revenue)],
        ["ต้นทุนขาย (COGS)", formatMoney(summary.cogs)],
        ["กำไรขั้นต้น (Gross Profit)", formatMoney(summary.gross_profit)],
        ["มูลค่าของเสีย (Wastage)", formatMoney(summary.wastage_value)],
        ["ค่าใช้จ่ายรวม (Expenses)", formatMoney(summary.total_expenses)],
        ["กำไรสุทธิ (Net Profit)", formatMoney(summary.net_profit)],
        ["มูลค่าสต็อกคงเหลือ", formatMoney(inventoryValue)],
        ["ส่วนของเจ้าของ", formatMoney(ownerEquity)]
      ]} />
    </Panel>
  </section>;
}
