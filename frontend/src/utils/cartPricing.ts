import type { CartItem, Product, SaleType } from "../types";

export function repriceFreebie(cart: CartItem[], products: Product[], saleType: SaleType, targetTotal?: number): CartItem[] {
  if (saleType !== "freebie") return cart;
  const buyUnits = cart.flatMap((item) => {
    if (item.is_freebie) return [];
    return Array.from({ length: item.qty }, () => ({ ...item, qty: 1 }));
  });
  const buyQty = buyUnits.length;
  if (!buyQty) return cart.map((item) => ({ ...item, unit_price: 0 }));

  const maxPrice = Math.max(...buyUnits.map((item) => products.find((product) => product.id === item.product_id)?.sell_price || 0));
  const target = Math.max(0, targetTotal ?? maxPrice * buyQty);
  const bases = buyUnits.map((item) => products.find((product) => product.id === item.product_id)?.sell_price || 0);
  const baseTotal = bases.reduce((sum, price) => sum + price, 0);
  if (!baseTotal) return cart.map((item) => ({ ...item, unit_price: 0 }));

  const pricedUnits = buyUnits.map((item, index) => {
    const exact = (target * bases[index]) / baseTotal;
    return { item, unit_price: Math.floor(exact), remainder: exact - Math.floor(exact), index };
  });
  let remaining = target - pricedUnits.reduce((sum, item) => sum + item.unit_price, 0);
  pricedUnits
    .slice()
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .forEach((unit) => {
      if (remaining > 0) {
        unit.unit_price += 1;
        remaining -= 1;
      }
    });

  return [
    ...pricedUnits.sort((a, b) => a.index - b.index).map(({ item, unit_price }) => ({ ...item, unit_price })),
    ...cart.filter((item) => item.is_freebie).map((item) => ({ ...item, unit_price: 0 }))
  ];
}
