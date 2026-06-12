import type { Product } from "../types";

export function ProductVisual({ product }: { product?: Product }) {
  const src = product?.image_data || product?.image_url;
  return <div className="product-visual">{src ? <img src={src} alt={product?.name_th || "product"} /> : <span>{product?.name_th.slice(0, 2) || "GH"}</span>}</div>;
}
