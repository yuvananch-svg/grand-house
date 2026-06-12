import type { BranchId, LocalState } from "../types";

export function BranchSelect({ state }: { state: LocalState }) {
  return <label><span>สาขา</span><select name="branch_id">{state.branches.map((branch) => <option key={branch.branch_id} value={branch.branch_id}>{branch.branch_name}</option>)}</select></label>;
}

export function OwnerBranchPicker({ state, value, onChange }: { state: LocalState; value: BranchId; onChange: (branch: BranchId) => void }) {
  return (
    <label className="inline-control">
      <span>สาขา (สำหรับเจ้าของ)</span>
      <select value={value} onChange={(event) => onChange(event.target.value as BranchId)}>
        {state.branches.map((branch) => <option key={branch.branch_id} value={branch.branch_id}>{branch.branch_name}</option>)}
      </select>
    </label>
  );
}

export function ProductSelect({ state }: { state: LocalState }) {
  const products = state.products.filter((product) => product.source_type === "parent" && product.active);
  return <label><span>สินค้า (บริษัทแม่)</span><select name="product_id">{products.map((product) => <option key={product.id} value={product.id}>{product.name_th} [{product.item_code}]</option>)}</select></label>;
}
