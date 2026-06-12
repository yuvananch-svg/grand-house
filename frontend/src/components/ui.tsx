import { Save } from "lucide-react";
import type { ComponentType, FormEvent, InputHTMLAttributes, ReactNode } from "react";
import { useState } from "react";

export type IconComponent = ComponentType<{ size?: string | number }>;

export function FormPanel({ title, icon: Icon, onSubmit, children }: { title: string; icon: IconComponent; onSubmit: (event: FormEvent<HTMLFormElement>) => void; children: ReactNode }) {
  return <Panel title={title} icon={Icon}>
    <form className="form-grid" onSubmit={onSubmit}>
      {children}
      <button className="primary" type="submit"><Save size={18} /> บันทึก</button>
    </form>
  </Panel>;
}

export function Panel({ title, icon: Icon, children }: { title: string; icon: IconComponent; children: ReactNode }) {
  return <section className="panel">
    <div className="panel-title"><Icon size={20} /><h3>{title}</h3></div>
    {children}
  </section>;
}

export function Metric({ label, value }: { label: string; value: string }) {
  return <article className="metric"><span>{label}</span><strong>{value}</strong></article>;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  const { label, name, ...rest } = props;
  return <label><span>{label}</span><input name={name} {...rest} /></label>;
}

function Numpad({ title, initial, allowDecimal = true, onConfirm, onClose }: { title: string; initial: string; allowDecimal?: boolean; onConfirm: (value: string) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(initial);
  function press(key: string) {
    if (key === "del") setDraft((current) => current.slice(0, -1));
    else if (key === "clear") setDraft("");
    else if (key === ".") setDraft((current) => (current.includes(".") ? current : (current || "0") + "."));
    else setDraft((current) => (current === "0" ? key : current + key));
  }
  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", allowDecimal ? "." : "00", "0", "del"];
  return (
    <div className="numpad-overlay" onClick={onClose}>
      <div className="numpad" onClick={(event) => event.stopPropagation()}>
        <div className="numpad-head">{title}</div>
        <div className="numpad-display">{draft || "0"}</div>
        <div className="numpad-grid">
          {keys.map((key) => <button key={key} type="button" onClick={() => press(key)}>{key === "del" ? "⌫" : key}</button>)}
        </div>
        <div className="numpad-actions">
          <button type="button" className="ghost" onClick={() => press("clear")}>ลบทั้งหมด</button>
          <button type="button" className="secondary" onClick={onClose}>ยกเลิก</button>
          <button type="button" className="primary" onClick={() => { onConfirm(draft); onClose(); }}>ตกลง</button>
        </div>
      </div>
    </div>
  );
}

export function NumpadInput({ label, value, onChange, allowDecimal = true, placeholder }: { label: string; value: string; onChange: (value: string) => void; allowDecimal?: boolean; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="numpad-field">
      <span>{label}</span>
      <button type="button" className="numpad-trigger" onClick={() => setOpen(true)}>{value || placeholder || "แตะเพื่อกรอก"}</button>
      {open && <Numpad title={label} initial={value} allowDecimal={allowDecimal} onConfirm={onChange} onClose={() => setOpen(false)} />}
    </div>
  );
}

export function SimpleTable({ headers, rows, empty = "ไม่มีข้อมูล", cardOnMobile = true }: { headers: string[]; rows?: ReactNode[][]; empty?: string; cardOnMobile?: boolean }) {
  return <div className={`table-wrap${cardOnMobile ? " card-on-mobile" : ""}`}><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>
    {rows && rows.length ? rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} data-label={headers[cellIndex] || ""}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length} className="empty">{empty}</td></tr>}
  </tbody></table></div>;
}
