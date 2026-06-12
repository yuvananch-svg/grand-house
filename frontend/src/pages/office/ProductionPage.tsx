import { ChefHat, Factory } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { callApi } from "../../api/client";
import { Metric, Panel, SimpleTable } from "../../components/ui";
import type { BranchId, LocalState, Session } from "../../types";
import { formatMoney, formatQuantity } from "../../utils/money";

interface ProductionPreview {
  lines: { material_id: string; needed: number; shortBy: number; cost: number }[];
  canRun: boolean;
  estimated_unit_cost: number;
}

interface ProductionPageProps {
  state: LocalState;
  session: Session;
  refresh: () => Promise<void>;
  notify: (message: string, kind?: "success" | "error") => void;
}

export function ProductionPage({ state, session, refresh, notify }: ProductionPageProps) {
  const [preview, setPreview] = useState<ProductionPreview | null>(null);
  const [branch, setBranch] = useState<BranchId>("BR-KASET");
  const [recipeId, setRecipeId] = useState(state.recipes.find((item) => item.active)?.id || "");
  const [qty, setQty] = useState("10");

  async function doPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await callApi<ProductionPreview>("production.preview", { recipe_id: recipeId, branch_id: branch, qty: Number(qty) }, session);
    if (response.ok) setPreview(response.data);
    else { setPreview(null); notify(response.message, "error"); }
  }

  async function doRun() {
    const response = await callApi("production.run", { recipe_id: recipeId, branch_id: branch, qty: Number(qty) }, session);
    notify(response.ok ? "ผลิตและล็อกต้นทุนแล้ว" : response.message, response.ok ? "success" : "error");
    if (response.ok) setPreview(null);
    await refresh();
  }

  return <section className="stack">
    <Panel title="ตรวจวัตถุดิบก่อนผลิต" icon={ChefHat}>
      <form className="form-grid" onSubmit={doPreview}>
        <label><span>สาขา</span><select value={branch} onChange={(event) => setBranch(event.target.value as BranchId)}>{state.branches.map((item) => <option key={item.branch_id} value={item.branch_id}>{item.branch_name}</option>)}</select></label>
        <label><span>สูตร</span><select value={recipeId} onChange={(event) => setRecipeId(event.target.value)}>{state.recipes.filter((item) => item.active).map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}</select></label>
        <label><span>จำนวนผลิต</span><input type="number" value={qty} onChange={(event) => setQty(event.target.value)} /></label>
        <button className="secondary" type="submit"><ChefHat size={18} /> ตรวจสอบ</button>
      </form>
    </Panel>
    {preview && (
      <Panel title={preview.canRun ? "✅ วัตถุดิบเพียงพอ ผลิตได้" : "❌ วัตถุดิบไม่พอ"} icon={Factory}>
        <SimpleTable headers={["วัตถุดิบ", "ต้องใช้", "สถานะ", "ต้นทุน"]} rows={preview.lines.map((line) => {
          const material = state.rawMaterials.find((item) => item.id === line.material_id);
          return [
            material ? `${material.name_th} [${material.item_code}]` : line.material_id,
            formatQuantity(line.needed, material?.display_factor, material?.display_unit),
            line.shortBy > 0 ? <span className="badge red">ขาด {formatQuantity(line.shortBy, material?.display_factor, material?.display_unit)}</span> : <span className="badge green">พอ</span>,
            `${formatMoney(line.cost)} บาท`
          ];
        })} />
        <div className="metric-grid">
          <Metric label="ต้นทุนต่อชิ้น (ประมาณ)" value={`${formatMoney(preview.estimated_unit_cost)} บาท`} />
        </div>
        <button className="primary giant" disabled={!preview.canRun} onClick={doRun}><Factory size={18} /> ผลิตจริง + ล็อกต้นทุน</button>
      </Panel>
    )}
  </section>;
}
