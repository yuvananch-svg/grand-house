import { describe, expect, it } from "vitest";
import type { CartItem, Product } from "../types";
import { repriceFreebie } from "./cartPricing";

function product(id: string, sell_price: number): Product {
  return {
    id,
    item_code: `PTG-${id}`,
    name_th: id,
    name_my: id,
    image_url: "",
    category: "rice_box",
    source_type: "parent",
    sell_price,
    staff_price: sell_price,
    shelf_life_days: 1,
    is_perishable: true,
    active: true
  };
}

describe("repriceFreebie", () => {
  it("allocates the freebie target total exactly across buy units", () => {
    const cart: CartItem[] = [
      { product_id: "A", qty: 3, unit_price: 4500, is_freebie: false },
      { product_id: "B", qty: 1, unit_price: 2500, is_freebie: false },
      { product_id: "C", qty: 2, unit_price: 0, is_freebie: true }
    ];

    const repriced = repriceFreebie(cart, [product("A", 4500), product("B", 2500), product("C", 2000)], "freebie");
    const total = repriced.reduce((sum, item) => sum + item.unit_price * item.qty, 0);

    expect(total).toBe(18000);
    expect(repriced.filter((item) => !item.is_freebie)).toHaveLength(4);
    expect(repriced.filter((item) => item.is_freebie).every((item) => item.unit_price === 0)).toBe(true);
  });

  it("uses a manually overridden freebie bill total when provided", () => {
    const cart: CartItem[] = [
      { product_id: "A", qty: 2, unit_price: 4500, is_freebie: false },
      { product_id: "B", qty: 1, unit_price: 2500, is_freebie: false },
      { product_id: "C", qty: 1, unit_price: 0, is_freebie: true }
    ];

    const repriced = repriceFreebie(cart, [product("A", 4500), product("B", 2500), product("C", 2000)], "freebie", 10000);

    expect(repriced.reduce((sum, item) => sum + item.unit_price * item.qty, 0)).toBe(10000);
  });

  it("does not reprice other sale types", () => {
    const cart: CartItem[] = [{ product_id: "A", qty: 2, unit_price: 4500, is_freebie: false }];

    expect(repriceFreebie(cart, [product("A", 4500)], "normal")).toBe(cart);
  });
});
