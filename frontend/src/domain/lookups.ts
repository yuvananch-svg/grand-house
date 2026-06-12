import type { BranchId, LocalState, PaymentMethod, Product, ProductCategory } from "../types";

export type PosCategory = "rice_parent" | "rice_house" | ProductCategory | "all";

export function productById(state: LocalState, product_id: string) {
  return state.products.find((product) => product.id === product_id);
}

export function branchName(state: LocalState, branch_id: BranchId) {
  if (branch_id === "ALL") return "ทุกสาขา";
  return state.branches.find((branch) => branch.branch_id === branch_id)?.branch_name || branch_id;
}

export function stockQty(state: LocalState, branch_id: BranchId, product_id: string) {
  return state.finishedLots.filter((lot) => lot.branch_id === branch_id && lot.product_id === product_id).reduce((sum, lot) => sum + lot.qty_remaining, 0);
}

export function paymentLabel(method: PaymentMethod) {
  const labels: Record<PaymentMethod, string> = { QR1: "QR1", QR2: "QR2", GRAB: "Grab", CASH: "เงินสด", THAI_HELP_THAI: "ไทยช่วยไทย", OTHER: "อื่นๆ" };
  return labels[method];
}

export function auditFlagIncludes(flag: string, expected: string) {
  return flag.split(",").map((item) => item.trim()).includes(expected);
}

export function productMatchesPosCategory(product: Product, category: PosCategory) {
  if (category === "all") return true;
  if (category === "rice_parent") return product.category === "rice_box" && product.source_type === "parent";
  if (category === "rice_house") return product.category === "rice_box" && product.source_type === "self_produced";
  return product.category === category;
}

export function bangkokDateFromIso(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(Number.isNaN(date.getTime()) ? new Date() : date);
}
