import { ChefHat, Factory, PackagePlus, Save, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { callApi } from "../../api/client";
import { masterItemCost } from "../../api/localAdapter";
import { ProductVisual } from "../../components/ProductVisual";
import { Panel, SimpleTable } from "../../components/ui";
import { productById } from "../../domain/lookups";
import { t } from "../../i18n";
import type { BranchId, ItemType, Language, LocalState, MasterItem, ProductCategory, RawMaterial, Session } from "../../types";
import { bahtToSatang, formatMoney, formatQuantity, satangToBaht } from "../../utils/money";

type ItemSource = "PTG" | "PGH" | "RM_PK" | "SUP";

const productCategories: { value: ProductCategory; labelKey: Parameters<typeof t>[1] }[] = [
  { value: "rice_box", labelKey: "categoryRiceBox" },
  { value: "savory", labelKey: "categorySavory" },
  { value: "drink", labelKey: "categoryDrink" },
  { value: "dessert", labelKey: "categoryDessert" },
  { value: "snack", labelKey: "categorySnack" },
  { value: "other", labelKey: "categoryOther" }
];

const itemSourceTabs: { key: ItemSource; label: string }[] = [
  { key: "PTG", label: "The Grand's (PTG)" },
  { key: "PGH", label: "Grand House (PGH)" },
  { key: "RM_PK", label: "วัตถุดิบ/บรรจุภัณฑ์ (RM/PK)" },
  { key: "SUP", label: "ซัพพลาย (SUP)" }
];

interface ItemsPageProps {
  state: LocalState;
  session: Session;
  refresh: () => Promise<void>;
  notify: (message: string, kind?: "success" | "error") => void;
}

interface ItemDraft {
  type: ItemType;
  id?: string;
  name_th: string;
  name_my: string;
  category: string;
  sell_baht: string;
  staff_baht: string;
  shelf_life_days: string;
  is_perishable: boolean;
  image_data: string;
  warehouse: "raw_fresh" | "dry_supply";
  base_unit: "g" | "ml" | "piece";
  display_unit: string;
  display_factor: string;
  unit: string;
}

interface IngredientRow {
  material_id: string;
  qty_display: string;
}

export function ItemsPage({ state, session, refresh, notify }: ItemsPageProps) {
  const [tab, setTab] = useState<"items" | "recipes">("items");
  return (
    <section className="stack">
      <div className="segmented">
        <button className={tab === "items" ? "active" : ""} onClick={() => setTab("items")}>สินค้า</button>
        <button className={tab === "recipes" ? "active" : ""} onClick={() => setTab("recipes")}>สูตรอาหาร</button>
      </div>
      {tab === "items"
        ? <ItemCatalog state={state} session={session} refresh={refresh} notify={notify} />
        : <RecipeManager state={state} session={session} refresh={refresh} notify={notify} />}
    </section>
  );
}

function emptyDraft(source: ItemSource): ItemDraft {
  return {
    type: source === "RM_PK" ? "RM" : (source as ItemType),
    name_th: "",
    name_my: "",
    category: source === "PTG" || source === "PGH" ? "rice_box" : "general",
    sell_baht: "",
    staff_baht: "",
    shelf_life_days: "1",
    is_perishable: true,
    image_data: "",
    warehouse: "raw_fresh",
    base_unit: "g",
    display_unit: "kg",
    display_factor: "1000",
    unit: "ชิ้น"
  };
}

function itemRemaining(state: LocalState, item: MasterItem): string {
  if (item.type === "PTG" || item.type === "PGH") {
    return String(state.finishedLots.filter((lot) => lot.product_id === item.source_id).reduce((sum, lot) => sum + lot.qty_remaining, 0));
  }
  if (item.type === "RM" || item.type === "PK") {
    const material = state.rawMaterials.find((entry) => entry.id === item.source_id);
    const base = state.rawLots.filter((lot) => lot.material_id === item.source_id).reduce((sum, lot) => sum + lot.qty_remaining, 0);
    return formatQuantity(base, material?.display_factor, material?.display_unit);
  }
  return "-";
}

function ItemCatalog({ state, session, refresh, notify }: ItemsPageProps) {
  const [source, setSource] = useState<ItemSource>("PTG");
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState<BranchId>("BR-KASET");
  const [draft, setDraft] = useState<ItemDraft>(() => emptyDraft("PTG"));
  const items = buildMasterItemsForUi(state).filter((item) => {
    const matchSource = source === "RM_PK" ? item.type === "RM" || item.type === "PK" : item.type === source;
    const matchSearch = !search.trim() || `${item.name_th} ${item.item_code} ${item.name_my}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchSource && matchSearch;
  });

  function pickSource(next: ItemSource) {
    setSource(next);
    setDraft(emptyDraft(next));
  }

  function editItem(item: MasterItem) {
    if (item.type === "PTG" || item.type === "PGH") {
      const product = state.products.find((entry) => entry.id === item.source_id);
      setSource(item.type);
      setDraft({
        ...emptyDraft(item.type),
        type: item.type,
        id: product?.id,
        name_th: product?.name_th || "",
        name_my: product?.name_my || "",
        category: product?.category || "rice_box",
        sell_baht: product ? String(satangToBaht(product.sell_price)) : "",
        staff_baht: product ? String(satangToBaht(product.staff_price)) : "",
        shelf_life_days: String(product?.shelf_life_days || 1),
        is_perishable: product?.is_perishable ?? true,
        image_data: product?.image_data || ""
      });
    } else if (item.type === "RM" || item.type === "PK") {
      const material = state.rawMaterials.find((entry) => entry.id === item.source_id) as RawMaterial | undefined;
      setSource("RM_PK");
      setDraft({
        ...emptyDraft("RM_PK"),
        type: item.type,
        id: material?.id,
        name_th: material?.name_th || "",
        name_my: material?.name_my || "",
        warehouse: material?.warehouse || "raw_fresh",
        base_unit: material?.base_unit || "g",
        display_unit: material?.display_unit || "kg",
        display_factor: String(material?.display_factor || 1)
      });
    } else {
      const supply = state.supplyItems.find((entry) => entry.id === item.source_id);
      setSource("SUP");
      setDraft({ ...emptyDraft("SUP"), type: "SUP", id: supply?.id, name_th: supply?.name_th || "", name_my: supply?.name_my || "", category: supply?.category || "general", unit: supply?.unit || "ชิ้น" });
    }
  }

  async function toggleActive(item: MasterItem) {
    const payload = { type: item.type, id: item.source_id, name_th: item.name_th, name_my: item.name_my, active: !item.active };
    const response = await callApi("item.save", payload, session);
    notify(response.ok ? "ปรับสถานะแล้ว" : response.message, response.ok ? "success" : "error");
    await refresh();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.name_th.trim()) {
      notify("กรอกชื่อสินค้า", "error");
      return;
    }
    const response = await callApi<{ item_code: string }>("item.save", buildItemPayload(draft, true), session);
    if (!response.ok) {
      notify(response.message, "error");
      return;
    }
    notify(`บันทึกแล้ว (${response.data.item_code})`);
    setDraft(emptyDraft(source));
    await refresh();
  }

  async function chooseImage(file: File | undefined) {
    if (!file) return;
    try {
      const image_data = await compressProductImage(file);
      setDraft((current) => ({ ...current, image_data }));
    } catch (error) {
      notify(error instanceof Error ? error.message : "รูปภาพไม่ถูกต้อง", "error");
    }
  }

  return (
    <section className="stack">
      <Panel title="แคตตาล็อกสินค้า (Master Item Catalog)" icon={ChefHat}>
        <div className="segmented">
          {itemSourceTabs.map((entry) => (
            <button key={entry.key} className={source === entry.key ? "active" : ""} onClick={() => pickSource(entry.key)}>{entry.label}</button>
          ))}
        </div>
        <div className="filter-row">
          <input placeholder="ค้นหา ชื่อ/รหัส" value={search} onChange={(event) => setSearch(event.target.value)} />
          {(source === "PGH" || source === "RM_PK") && (
            <select value={branch} onChange={(event) => setBranch(event.target.value as BranchId)}>
              {state.branches.map((item) => <option key={item.branch_id} value={item.branch_id}>{item.branch_name}</option>)}
            </select>
          )}
        </div>
        <SimpleTable
          headers={["รหัส", "ชื่อ", "หมวด", "ราคาขาย", "ต้นทุน", "คงเหลือ", "สถานะ", ""]}
          rows={items.map((item) => [
            item.item_code,
            item.name_th,
            item.type === "PTG" || item.type === "PGH" ? productCategoryLabel("th", item.category) : item.category,
            item.sell_price != null ? `${formatMoney(item.sell_price)} บาท` : "-",
            `${formatMoney(masterItemCost(state, item, branch))} บาท`,
            itemRemaining(state, item),
            <button key={`${item.id}-s`} className={item.active ? "secondary" : "danger"} onClick={() => toggleActive(item)}>{item.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}</button>,
            <button key={`${item.id}-e`} className="ghost" onClick={() => editItem(item)}>แก้ไข</button>
          ])}
          empty="ยังไม่มีรายการในกลุ่มนี้"
        />
      </Panel>

      <Panel title={draft.id ? `แก้ไขรายการ ${draft.id}` : "เพิ่มรายการใหม่"} icon={Save}>
        <form className="form-grid" onSubmit={submit}>
          <label><span>ชื่อ (ไทย)</span><input value={draft.name_th} onChange={(event) => setDraft({ ...draft, name_th: event.target.value })} /></label>
          <label><span>ชื่อ (พม่า)</span><input value={draft.name_my} onChange={(event) => setDraft({ ...draft, name_my: event.target.value })} /></label>
          {(source === "PTG" || source === "PGH") && (
            <>
              <label><span>หมวด</span><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
                {productCategories.map((cat) => <option key={cat.value} value={cat.value}>{t("th", cat.labelKey)}</option>)}
              </select></label>
              <label><span>ราคาขาย (บาท)</span><input inputMode="decimal" value={draft.sell_baht} onChange={(event) => setDraft({ ...draft, sell_baht: event.target.value })} /></label>
              <label><span>ราคาพนักงาน (บาท)</span><input inputMode="decimal" value={draft.staff_baht} onChange={(event) => setDraft({ ...draft, staff_baht: event.target.value })} /></label>
              <label><span>อายุสินค้า (วัน)</span><input type="number" value={draft.shelf_life_days} onChange={(event) => setDraft({ ...draft, shelf_life_days: event.target.value })} /></label>
              <label className="checkbox-row"><input type="checkbox" checked={draft.is_perishable} onChange={(event) => setDraft({ ...draft, is_perishable: event.target.checked })} /><span>มีวันหมดอายุ</span></label>
              <label><span>รูปสินค้า</span><input type="file" accept="image/*" onChange={(event) => void chooseImage(event.target.files?.[0])} /></label>
              {draft.image_data && (
                <div className="image-preview">
                  <img src={draft.image_data} alt="preview" />
                  <button type="button" className="ghost" onClick={() => setDraft({ ...draft, image_data: "" })}>ลบรูป</button>
                </div>
              )}
            </>
          )}
          {source === "RM_PK" && (
            <>
              <label><span>ประเภท</span><select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as ItemType })}>
                <option value="RM">วัตถุดิบ (RM)</option>
                <option value="PK">บรรจุภัณฑ์ (PK)</option>
              </select></label>
              <label><span>คลัง</span><select value={draft.warehouse} onChange={(event) => setDraft({ ...draft, warehouse: event.target.value as ItemDraft["warehouse"] })}>
                <option value="raw_fresh">ของสด</option>
                <option value="dry_supply">ของแห้ง/บรรจุภัณฑ์</option>
              </select></label>
              <label><span>หน่วยฐาน</span><select value={draft.base_unit} onChange={(event) => setDraft({ ...draft, base_unit: event.target.value as ItemDraft["base_unit"] })}>
                <option value="g">g</option><option value="ml">ml</option><option value="piece">piece</option>
              </select></label>
              <label><span>หน่วยแสดงผล</span><input value={draft.display_unit} onChange={(event) => setDraft({ ...draft, display_unit: event.target.value })} /></label>
              <label><span>ตัวคูณหน่วย (เช่น kg=1000g)</span><input type="number" value={draft.display_factor} onChange={(event) => setDraft({ ...draft, display_factor: event.target.value })} /></label>
            </>
          )}
          {source === "SUP" && (
            <>
              <label><span>หมวด</span><input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></label>
              <label><span>หน่วย</span><input value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} /></label>
            </>
          )}
          <div className="button-row">
            <button className="primary" type="submit"><Save size={18} /> บันทึก</button>
            {draft.id && <button type="button" className="ghost" onClick={() => setDraft(emptyDraft(source))}>ยกเลิกแก้ไข</button>}
          </div>
        </form>
      </Panel>
    </section>
  );
}

function buildItemPayload(draft: ItemDraft, active: boolean) {
  const base = { type: draft.type, id: draft.id, name_th: draft.name_th.trim(), name_my: draft.name_my.trim(), active };
  if (draft.type === "PTG" || draft.type === "PGH") {
    return {
      ...base,
      category: draft.category,
      sell_price: draft.sell_baht.trim() ? bahtToSatang(draft.sell_baht) : 0,
      staff_price: draft.staff_baht.trim() ? bahtToSatang(draft.staff_baht) : 0,
      shelf_life_days: Number(draft.shelf_life_days) || 1,
      is_perishable: draft.is_perishable,
      image_data: draft.image_data
    };
  }
  if (draft.type === "RM" || draft.type === "PK") {
    return { ...base, warehouse: draft.warehouse, base_unit: draft.base_unit, display_unit: draft.display_unit, display_factor: Number(draft.display_factor) || 1 };
  }
  return { ...base, category: draft.category, unit: draft.unit };
}

async function compressProductImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("ไฟล์นี้ไม่ใช่รูปภาพ");
  const bitmap = await createImageBitmap(file);
  const size = 300;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ไม่สามารถประมวลผลรูปภาพได้");
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = Math.round((bitmap.width - side) / 2);
  const sy = Math.round((bitmap.height - side) / 2);
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close();
  for (const quality of [0.72, 0.62, 0.52, 0.42, 0.34]) {
    const dataUrl = canvas.toDataURL("image/webp", quality);
    if (dataUrl.length <= 45_000) return dataUrl;
  }
  throw new Error("รูปใหญ่เกินไปหลังบีบอัด กรุณาเลือกภาพที่เรียบหรือเล็กลง");
}

function RecipeManager({ state, session, refresh, notify }: ItemsPageProps) {
  const products = state.products.filter((product) => product.source_type === "self_produced" && product.active);
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [name, setName] = useState("");
  const [batchYield, setBatchYield] = useState("1");
  const [rows, setRows] = useState<IngredientRow[]>([{ material_id: state.rawMaterials[0]?.id || "", qty_display: "1" }]);
  const [branch, setBranch] = useState<BranchId>("BR-KASET");

  function updateRow(index: number, patch: Partial<IngredientRow>) {
    setRows(rows.map((row, current) => (current === index ? { ...row, ...patch } : row)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!productId) {
      notify("เลือกเมนูผลลัพธ์ (PGH)", "error");
      return;
    }
    const yieldQty = Math.max(1, Number(batchYield) || 1);
    const items = rows
      .filter((row) => row.material_id && Number(row.qty_display) > 0)
      .map((row) => {
        const material = state.rawMaterials.find((entry) => entry.id === row.material_id);
        const baseTotal = Number(row.qty_display) * (material?.display_factor || 1);
        return { material_id: row.material_id, qty_per_unit: Math.round(baseTotal / yieldQty) };
      });
    if (!items.length) {
      notify("ใส่ส่วนผสมอย่างน้อย 1 รายการ", "error");
      return;
    }
    const response = await callApi("recipe.save", { product_id: productId, name: name.trim() || productById(state, productId)?.name_th, items }, session);
    notify(response.ok ? "บันทึกสูตรแล้ว (ปิดสูตรเก่าอัตโนมัติ)" : response.message, response.ok ? "success" : "error");
    if (response.ok) {
      setName("");
      setRows([{ material_id: state.rawMaterials[0]?.id || "", qty_display: "1" }]);
    }
    await refresh();
  }

  const activeRecipes = state.recipes.filter((recipe) => recipe.active);

  return (
    <section className="stack">
      <Panel title="สร้าง/แก้ไขสูตรอาหาร (BOM)" icon={Factory}>
        <form className="form-grid" onSubmit={submit}>
          <label><span>เมนูผลลัพธ์ (ผลิตเอง PGH)</span><select value={productId} onChange={(event) => setProductId(event.target.value)}>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name_th} [{product.item_code}]</option>)}
          </select></label>
          <label><span>ชื่อสูตร</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="เว้นว่าง = ใช้ชื่อเมนู" /></label>
          <label><span>จำนวนที่ได้ต่อ 1 รอบสูตร</span><input type="number" value={batchYield} onChange={(event) => setBatchYield(event.target.value)} /></label>
          <div className="recipe-rows">
            {rows.map((row, index) => {
              const material = state.rawMaterials.find((entry) => entry.id === row.material_id);
              return (
                <div className="recipe-row" key={index}>
                  <select value={row.material_id} onChange={(event) => updateRow(index, { material_id: event.target.value })}>
                    {state.rawMaterials.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name_th} [{item.item_code}]</option>)}
                  </select>
                  <input inputMode="decimal" value={row.qty_display} onChange={(event) => updateRow(index, { qty_display: event.target.value })} />
                  <span className="unit-hint">{material?.display_unit}</span>
                  <button type="button" className="icon-danger" onClick={() => setRows(rows.filter((_, current) => current !== index))}><Trash2 size={16} /></button>
                </div>
              );
            })}
          </div>
          <div className="button-row">
            <button type="button" className="secondary" onClick={() => setRows([...rows, { material_id: state.rawMaterials[0]?.id || "", qty_display: "1" }])}><PackagePlus size={16} /> เพิ่มส่วนผสม</button>
            <button className="primary" type="submit"><Save size={18} /> บันทึกสูตร</button>
          </div>
        </form>
      </Panel>
      <Panel title="สูตรที่ใช้งานอยู่ + ต้นทุนประมาณ" icon={ChefHat}>
        <div className="filter-row">
          <select value={branch} onChange={(event) => setBranch(event.target.value as BranchId)}>
            {state.branches.map((item) => <option key={item.branch_id} value={item.branch_id}>{item.branch_name}</option>)}
          </select>
        </div>
        {activeRecipes.length === 0 && <p className="empty">ยังไม่มีสูตร</p>}
        {activeRecipes.map((recipe) => {
          const ingredients = state.recipeItems.filter((item) => item.recipe_id === recipe.id);
          const unitCost = masterItemCost(state, { type: "PGH", source_id: recipe.product_id }, branch);
          return (
            <details key={recipe.id} className="recipe-detail">
              <summary>{recipe.name} - ต้นทุนประมาณ {formatMoney(unitCost)} บาท/หน่วย</summary>
              <SimpleTable headers={["ส่วนผสม", "ปริมาณ/หน่วย (ฐาน)"]} rows={ingredients.map((item) => [
                state.rawMaterials.find((entry) => entry.id === item.material_id)?.name_th || item.material_id,
                String(item.qty_per_unit)
              ])} />
            </details>
          );
        })}
      </Panel>
    </section>
  );
}

function buildMasterItemsForUi(state: LocalState): MasterItem[] {
  const items: MasterItem[] = [];
  state.products.forEach((product) => items.push({
    id: product.id,
    item_code: product.item_code,
    name_th: product.name_th,
    name_my: product.name_my,
    type: product.source_type === "parent" ? "PTG" : "PGH",
    category: product.category,
    unit: "กล่อง/ชิ้น",
    active: product.active,
    sell_price: product.sell_price,
    staff_price: product.staff_price,
    source_id: product.id
  }));
  state.rawMaterials.forEach((material) => items.push({
    id: material.id,
    item_code: material.item_code,
    name_th: material.name_th,
    name_my: material.name_my,
    type: material.is_packaging ? "PK" : "RM",
    category: material.warehouse,
    unit: material.display_unit,
    active: material.active,
    source_id: material.id
  }));
  state.supplyItems.forEach((supply) => items.push({
    id: supply.id,
    item_code: supply.item_code,
    name_th: supply.name_th,
    name_my: supply.name_my,
    type: "SUP",
    category: supply.category,
    unit: supply.unit,
    active: supply.active,
    source_id: supply.id
  }));
  return items;
}

function productCategoryLabel(language: Language, category: string) {
  const found = productCategories.find((item) => item.value === category);
  return found ? t(language, found.labelKey) : category;
}
