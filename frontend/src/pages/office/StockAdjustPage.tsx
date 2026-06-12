import { ShieldAlert } from "lucide-react";
import type { FormEvent } from "react";
import { callApi } from "../../api/client";
import { FormPanel, Input } from "../../components/ui";
import type { LocalState, Session } from "../../types";

interface StockAdjustPageProps {
  state: LocalState;
  session: Session;
  refresh: () => Promise<void>;
  notify: (message: string, kind?: "success" | "error") => void;
}

export function StockAdjustPage({ session, refresh, notify }: StockAdjustPageProps) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await callApi("stockAdjust.request", {
      target_type: form.get("target_type"),
      lot_id: form.get("lot_id"),
      qty_after: Number(form.get("qty_after")),
      reason: form.get("reason"),
      owner_pin: form.get("owner_pin")
    }, session);
    notify(response.ok ? "ปรับสต็อกแล้ว" : response.message, response.ok ? "success" : "error");
    await refresh();
  }

  return <FormPanel title="ปรับสต็อกด้วย PIN เจ้าของ" icon={ShieldAlert} onSubmit={submit}>
    <label><span>ชนิดล็อต</span><select name="target_type"><option value="finished_lot">finished_lot</option><option value="raw_lot">raw_lot</option></select></label>
    <Input name="lot_id" label="Lot ID" placeholder="FLOT-... หรือ RLOT-..." />
    <Input name="qty_after" label="จำนวนจริงที่นับได้" type="number" defaultValue="0" />
    <Input name="reason" label="เหตุผล" defaultValue="นับจริงไม่ตรงระบบ" />
    <Input name="owner_pin" label="PIN เจ้าของ" inputMode="numeric" placeholder="246810" />
  </FormPanel>;
}
