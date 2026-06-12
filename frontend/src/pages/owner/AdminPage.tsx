import { RotateCcw, ShieldAlert, UserCog } from "lucide-react";
import type { FormEvent } from "react";
import { callApi, getApiMode } from "../../api/client";
import { FormPanel, Input, Panel, SimpleTable } from "../../components/ui";
import { branchName } from "../../domain/lookups";
import { resetDemoData } from "../../stores/dataStore";
import type { LocalState, Session } from "../../types";

type AdminPageProps = {
  state: LocalState;
  session: Session;
  refresh: () => Promise<void>;
  notify: (message: string, kind?: "success" | "error") => void;
};

const configFields: { key: keyof LocalState["config"]; label: string }[] = [
  { key: "void_window_minutes", label: "นาทียกเลิกบิล" },
  { key: "day_cutoff_hour", label: "ชั่วโมงตัดวัน" },
  { key: "suspicious_price_pct", label: "ราคาต่ำผิดปกติ (%)" },
  { key: "suspicious_staffsale_per_day", label: "ขายพนักงาน/วัน" },
  { key: "suspicious_wastage_value", label: "มูลค่าทิ้งผิดปกติ (สตางค์)" },
  { key: "rate_limit_per_min", label: "Rate limit/อุปกรณ์/นาที" },
  { key: "global_rate_limit_per_min", label: "Global rate limit/นาที" },
  { key: "login_lockout_attempts", label: "ล็อกเมื่อผิดกี่ครั้ง" },
  { key: "lockout_minutes", label: "นาทีที่ล็อก" }
];

export function AdminPage({ state, session, refresh, notify }: AdminPageProps) {
  const isLocalMode = getApiMode() === "local";

  async function manage(payload: Record<string, unknown>, okMessage: string) {
    const response = await callApi("user.manage", payload, session);
    notify(response.ok ? okMessage : response.message, response.ok ? "success" : "error");
    await refresh();
  }

  async function reset() {
    if (!window.confirm("ล้างข้อมูล local ทั้งหมดกลับเป็น seed?")) return;
    await resetDemoData();
    notify("Reset local state แล้ว");
    await refresh();
  }

  async function addUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(event.currentTarget);
    await manage({ mode: "add_user", user: {
      user_id: String(form.get("user_id")).trim(),
      password: String(form.get("password")),
      display_name: String(form.get("display_name")),
      role: form.get("role"),
      branch_id: form.get("branch_id"),
      approval_pin: String(form.get("approval_pin") || "") || undefined
    } }, "เพิ่มผู้ใช้แล้ว");
    formEl.reset();
  }

  async function resetPw(id: string, user_id: string) {
    const password = window.prompt(`ตั้งรหัสผ่านใหม่ของ ${user_id}`);
    if (password) await manage({ mode: "reset_password", id, password }, "รีเซ็ตรหัสผ่านแล้ว");
  }

  async function setPin(id: string, user_id: string) {
    const approval_pin = window.prompt(`ตั้ง PIN อนุมัติของ ${user_id} (6 หลัก)`);
    if (approval_pin) await manage({ mode: "set_pin", id, approval_pin }, "ตั้ง PIN แล้ว");
  }

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const config: Record<string, number> = {};
    configFields.forEach((field) => { config[field.key] = Number(form.get(field.key)); });
    await manage({ mode: "set_config", config }, "บันทึก Config แล้ว");
  }

  return <section className="stack">
    <Panel title="จัดการผู้ใช้" icon={UserCog}>
      <SimpleTable headers={["User ID", "ชื่อ", "สิทธิ์", "สาขา", "สถานะ", "จัดการ"]} rows={state.users.map((user) => [
        user.user_id,
        user.display_name,
        user.role,
        branchName(state, user.branch_id),
        user.pin_locked_until && new Date(user.pin_locked_until) > new Date() ? "PIN ถูกล็อก" : user.active ? "ใช้งาน" : "ปิด",
        <div className="button-row" key={user.id}>
          <button className={user.active ? "danger" : "secondary"} onClick={() => manage({ mode: "update_user", id: user.id, user: { active: !user.active } }, "อัปเดตผู้ใช้แล้ว")}>{user.active ? "ปิดบัญชี" : "เปิดบัญชี"}</button>
          <button className="ghost" onClick={() => resetPw(user.id, user.user_id)}>รีเซ็ตรหัส</button>
          <button className="ghost" onClick={() => setPin(user.id, user.user_id)}>ตั้ง PIN</button>
          <button className="ghost" onClick={() => manage({ mode: "force_logout", id: user.id }, "Force logout แล้ว")}>Force logout</button>
        </div>
      ])} />
    </Panel>
    <FormPanel title="เพิ่มผู้ใช้ใหม่" icon={UserCog} onSubmit={addUser}>
      <Input name="user_id" label="User ID" />
      <Input name="password" label="รหัสผ่าน" />
      <Input name="display_name" label="ชื่อแสดงผล" />
      <label><span>สิทธิ์</span><select name="role"><option value="staff">staff</option><option value="office">office</option><option value="owner">owner</option></select></label>
      <BranchSelectAll state={state} />
      <Input name="approval_pin" label="PIN อนุมัติ (เฉพาะ owner)" inputMode="numeric" />
    </FormPanel>
    <FormPanel title="ตั้งค่าระบบ (Config)" icon={ShieldAlert} onSubmit={saveConfig}>
      {configFields.map((field) => <Input key={field.key} name={field.key} label={field.label} type="number" defaultValue={String(state.config[field.key])} />)}
    </FormPanel>
    <Panel title="Devices" icon={UserCog}>
      <SimpleTable headers={["Device", "Label", "Branch", "Status", "Action"]} rows={state.devices.map((device) => [
        device.device_id.slice(0, 18),
        device.label,
        branchName(state, device.branch_id),
        device.status,
        <button key={device.device_id} className={device.status === "blocked" ? "secondary" : "danger"} onClick={() => manage({ mode: device.status === "blocked" ? "unblock_device" : "block_device", device_id: device.device_id }, "เปลี่ยนสถานะอุปกรณ์แล้ว")}>{device.status === "blocked" ? "Unblock" : "Block"}</button>
      ])} />
    </Panel>
    {isLocalMode && (
      <Panel title="Local maintenance" icon={RotateCcw}>
        <button className="danger" onClick={reset}><RotateCcw size={18} /> Reset local seed</button>
      </Panel>
    )}
  </section>;
}

function BranchSelectAll({ state }: { state: LocalState }) {
  return <label><span>สาขา</span><select name="branch_id"><option value="ALL">ทุกสาขา (ALL)</option>{state.branches.map((branch) => <option key={branch.branch_id} value={branch.branch_id}>{branch.branch_name}</option>)}</select></label>;
}
