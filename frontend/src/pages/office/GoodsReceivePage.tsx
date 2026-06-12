import { History, PackagePlus } from "lucide-react";
import type { FormEvent } from "react";
import { callApi } from "../../api/client";
import { BranchSelect, ProductSelect } from "../../components/selects";
import { FormPanel, Input, Panel, SimpleTable } from "../../components/ui";
import { branchName, productById } from "../../domain/lookups";
import type { LocalState, Session } from "../../types";
import { todayBangkok } from "../../utils/ids";
import { bahtToSatang, formatMoney } from "../../utils/money";

interface GoodsReceivePageProps {
  state: LocalState;
  session: Session;
  refresh: () => Promise<void>;
  notify: (message: string, kind?: "success" | "error") => void;
}

export function GoodsReceivePage({ state, session, refresh, notify }: GoodsReceivePageProps) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const response = await callApi("goods.receive", {
      branch_id: form.get("branch_id"),
      product_id: form.get("product_id"),
      qty: Number(form.get("qty")),
      unit_cost: bahtToSatang(String(form.get("unit_cost"))),
      received_date: String(form.get("received_date"))
    }, session);
    notify(response.ok ? "รับของแล้ว" : response.message, response.ok ? "success" : "error");
    if (response.ok) formEl.reset();
    await refresh();
  }

  const recent = state.goodsReceipts.slice(-20).reverse();

  return <section className="stack">
    <FormPanel title="รับสินค้าจากบริษัทแม่" icon={PackagePlus} onSubmit={submit}>
      <BranchSelect state={state} />
      <ProductSelect state={state} />
      <Input name="qty" label="จำนวนชิ้น" type="number" defaultValue="10" />
      <Input name="unit_cost" label="ต้นทุนต่อชิ้น (บาท)" type="number" step="0.01" defaultValue="18" />
      <Input name="received_date" label="วันที่รับ" type="date" defaultValue={todayBangkok()} />
    </FormPanel>
    <Panel title="รับเข้าล่าสุด 20 รายการ" icon={History}>
      <SimpleTable headers={["วันที่", "สาขา", "สินค้า", "จำนวน", "ต้นทุน/ชิ้น"]} rows={recent.map((receipt) => [
        receipt.received_date,
        branchName(state, receipt.branch_id),
        productById(state, receipt.product_id)?.name_th || receipt.product_id,
        String(receipt.qty),
        `${formatMoney(receipt.unit_cost)} บาท`
      ])} empty="ยังไม่มีการรับเข้า" />
    </Panel>
  </section>;
}
