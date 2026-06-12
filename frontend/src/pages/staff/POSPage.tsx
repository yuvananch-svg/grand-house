import { Trash2 } from "lucide-react";
import { useState } from "react";
import { buildSaleDraftFromCart } from "../../api/localAdapter";
import { ProductVisual } from "../../components/ProductVisual";
import { NumpadInput } from "../../components/ui";
import { flushOutbox, queueStaffAction } from "../../db/syncEngine";
import { paymentLabel, productById, productMatchesPosCategory, stockQty, type PosCategory } from "../../domain/lookups";
import { paymentMethods } from "../../domain/reporting";
import { t } from "../../i18n";
import type { BranchId, CartItem, Language, LocalState, PaymentMethod, Product, SaleType, Session } from "../../types";
import { repriceFreebie } from "../../utils/cartPricing";
import { bahtToSatang, formatMoney, satangToBaht } from "../../utils/money";

type PosMode = SaleType | "wastage";

const saleTypes: { type: PosMode; labelKey: "saleNormal" | "saleDiscount" | "saleFreebie" | "saleStaff" | "saleWastage"; tone: string }[] = [
  { type: "normal", labelKey: "saleNormal", tone: "green" },
  { type: "discount", labelKey: "saleDiscount", tone: "amber" },
  { type: "freebie", labelKey: "saleFreebie", tone: "sky" },
  { type: "staff", labelKey: "saleStaff", tone: "violet" },
  { type: "wastage", labelKey: "saleWastage", tone: "red" }
];

const posCategories: { value: PosCategory; labelKey: Parameters<typeof t>[1] }[] = [
  { value: "rice_parent", labelKey: "categoryRiceParent" },
  { value: "rice_house", labelKey: "categoryRiceHouse" },
  { value: "savory", labelKey: "categorySavory" },
  { value: "drink", labelKey: "categoryDrink" },
  { value: "dessert", labelKey: "categoryDessert" },
  { value: "snack", labelKey: "categorySnack" },
  { value: "other", labelKey: "categoryOther" },
  { value: "all", labelKey: "categoryAll" }
];

interface POSPageProps {
  state: LocalState;
  session: Session;
  language: Language;
  refresh: () => Promise<void>;
  notify: (message: string, kind?: "success" | "error") => void;
}

export function POSPage({ state, session, language, refresh, notify }: POSPageProps) {
  const [saleType, setSaleType] = useState<PosMode>("normal");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [freebieMode, setFreebieMode] = useState<"buy" | "gift">("buy");
  const [freebieTotalBaht, setFreebieTotalBaht] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("QR1");
  const [cashBaht, setCashBaht] = useState("");
  const [ownerBranch, setOwnerBranch] = useState<BranchId>("BR-KASET");
  const [category, setCategory] = useState<PosCategory>("all");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const branch_id = session.branch_id === "ALL" ? ownerBranch : session.branch_id;
  const allProducts = state.products.filter((product) => product.active);
  const products = allProducts.filter((product) => productMatchesPosCategory(product, category));
  const isWastageMode = saleType === "wastage";
  const freebieTarget = freebieTotalBaht.trim() ? Math.max(0, bahtToSatang(freebieTotalBaht)) : undefined;
  const total = isWastageMode ? 0 : cart.reduce((sum, item) => sum + item.unit_price * item.qty, 0);
  const cashReceived = bahtToSatang(cashBaht);
  const cashValid = payment !== "CASH" || cashReceived >= total;
  const canFinish = cart.length > 0 && (isWastageMode || (cashValid && (saleType !== "freebie" || cart.some((item) => !item.is_freebie))));
  const isMobileCartOpen = mobileCartOpen && cart.length > 0;

  function addProduct(product: Product) {
    const isGift = saleType === "freebie" && freebieMode === "gift";
    const basePrice = isWastageMode ? 0 : saleType === "staff" ? product.staff_price : product.sell_price;
    const next = [...cart];
    const found = next.find((item) => item.product_id === product.id && item.is_freebie === isGift);
    if (found) found.qty += 1;
    else next.push({ product_id: product.id, qty: 1, unit_price: isGift ? 0 : basePrice, is_freebie: isGift });
    setCart(isWastageMode ? next : repriceFreebie(next, allProducts, saleType as SaleType, freebieTarget));
    setMobileCartOpen(true);
  }

  function updateQty(index: number, qty: number) {
    const next = cart.map((item, current) => (current === index ? { ...item, qty: Math.max(1, qty) } : item));
    setCart(isWastageMode ? next : repriceFreebie(next, allProducts, saleType as SaleType, freebieTarget));
  }

  function updateDiscountPrice(index: number, value: string) {
    const unit_price = Math.max(0, bahtToSatang(value));
    setCart(cart.map((item, current) => (current === index ? { ...item, unit_price } : item)));
  }

  function removeItem(index: number) {
    const next = cart.filter((_, current) => current !== index);
    setCart(isWastageMode ? next : repriceFreebie(next, allProducts, saleType as SaleType, freebieTarget));
  }

  function updateFreebieTotal(value: string) {
    setFreebieTotalBaht(value);
    const target = value.trim() ? Math.max(0, bahtToSatang(value)) : undefined;
    setCart(repriceFreebie(cart, allProducts, saleType as SaleType, target));
  }

  async function finishWastage() {
    const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
    if (!window.confirm(`ยืนยันตัดของเสีย ${cart.length} รายการ รวม ${totalQty} ชิ้น?`)) return;
    for (const item of cart) {
      await queueStaffAction("wastage.create", { product_id: item.product_id, qty: item.qty, branch_id });
    }
    await flushOutbox(session);
    setCart([]);
    setMobileCartOpen(false);
    notify(navigator.onLine ? "บันทึกของเสียแล้ว" : "บันทึกของเสียลงเครื่องแล้ว รอส่ง");
    await refresh();
  }

  async function finishSale() {
    if (isWastageMode) {
      await finishWastage();
      return;
    }
    const draft = buildSaleDraftFromCart({
      cart,
      sale_type: saleType as SaleType,
      payment_method: payment,
      cash_received: payment === "CASH" ? cashReceived : 0,
      branch_id,
      user_id: session.user_id,
      device_id: session.device_id
    });
    await queueStaffAction("sale.syncBatch", { sales: [draft] });
    await flushOutbox(session);
    setCart([]);
    setMobileCartOpen(false);
    setCashBaht("");
    notify(navigator.onLine ? "บันทึกบิลแล้ว" : "บันทึกลงเครื่องแล้ว รอส่ง");
    await refresh();
  }

  return (
    <section className="stack">
      {session.branch_id === "ALL" && (
        <label className="inline-control">
          <span>สาขา (สำหรับเจ้าของ)</span>
          <select value={ownerBranch} onChange={(event) => { setOwnerBranch(event.target.value as BranchId); setCart([]); }}>
            {state.branches.map((item) => <option key={item.branch_id} value={item.branch_id}>{item.branch_name}</option>)}
          </select>
        </label>
      )}
      <div className="sale-type-grid">
        {saleTypes.map((item) => (
          <button key={item.type} className={`sale-type ${saleType === item.type ? "active" : ""} ${item.tone}`} onClick={() => {
            setSaleType(item.type);
            setCart([]);
            setFreebieTotalBaht("");
          }}>
            {t(language, item.labelKey)}
          </button>
        ))}
      </div>
      {saleType === "freebie" && (
        <div className="segmented">
          <button className={freebieMode === "buy" ? "active" : ""} onClick={() => setFreebieMode("buy")}>ตัวซื้อ</button>
          <button className={freebieMode === "gift" ? "active" : ""} onClick={() => setFreebieMode("gift")}>ตัวแถม</button>
        </div>
      )}
      {saleType === "freebie" && (
        <NumpadInput label="ยอดรวมบิลแถม (บาท)" value={freebieTotalBaht} onChange={updateFreebieTotal} placeholder="ว่าง = คำนวณอัตโนมัติ" />
      )}
      <div className="category-filter">
        {posCategories.map((item) => {
          const count = allProducts.filter((product) => productMatchesPosCategory(product, item.value)).length;
          return (
            <button key={item.value} className={category === item.value ? "active" : ""} onClick={() => setCategory(item.value)}>
              <span>{t(language, item.labelKey)}</span>
              <b>{count}</b>
            </button>
          );
        })}
      </div>
      <div className="pos-layout">
        <div className="product-grid">
          {products.map((product) => (
            <button key={product.id} className="product-card" onClick={() => addProduct(product)}>
              <ProductVisual product={product} />
              <strong>{language === "my" ? product.name_my : product.name_th}</strong>
              <span>{formatMoney(saleType === "staff" ? product.staff_price : product.sell_price)} บาท</span>
              {isWastageMode && <span className="danger-text">ตัดของเสีย</span>}
              <em>คงเหลือประมาณ {stockQty(state, branch_id, product.id)}</em>
            </button>
          ))}
        </div>
        <aside className={`cart-panel ${isMobileCartOpen ? "open" : ""}`}>
          <div className="mobile-cart-toggle">
            <button className="mobile-cart-summary" type="button" onClick={() => setMobileCartOpen((open) => (cart.length > 0 ? !open : false))} aria-expanded={isMobileCartOpen}>
              <span>{t(language, "cart")} · {cart.reduce((sum, item) => sum + item.qty, 0)} ชิ้น</span>
              <strong>{isWastageMode ? "ของเสีย" : `${formatMoney(total)} บาท`}</strong>
            </button>
            <button className={isWastageMode ? "mobile-cart-finish danger" : "mobile-cart-finish primary"} type="button" disabled={!canFinish} onClick={finishSale} aria-label={isWastageMode ? t(language, "confirmWastage") : t(language, "finishSale")}>
              {isWastageMode ? "บันทึก" : "จบ"}
            </button>
          </div>
          <div className="cart-drawer">
            <h3>{t(language, "cart")}</h3>
            <div className="cart-list">
              {cart.map((item, index) => {
                const product = productById(state, item.product_id);
                return (
                  <div className="cart-row" key={`${item.product_id}-${item.is_freebie}-${index}`}>
                    <div>
                      <strong>{product?.name_th}</strong>
                      <span>{isWastageMode ? "ของเสีย" : item.is_freebie ? "แถม" : formatMoney(item.unit_price)}</span>
                      {(saleType === "discount" || saleType === "staff") && !item.is_freebie && (
                        <NumpadInput label="ราคา/ชิ้น (บาท)" value={String(satangToBaht(item.unit_price))} onChange={(value) => updateDiscountPrice(index, value)} />
                      )}
                    </div>
                    <div className="qty-stepper">
                      <button onClick={() => updateQty(index, item.qty - 1)}>-</button>
                      <span>{item.qty}</span>
                      <button onClick={() => updateQty(index, item.qty + 1)}>+</button>
                    </div>
                    <button className="icon-danger" onClick={() => removeItem(index)}><Trash2 size={16} /></button>
                  </div>
                );
              })}
            </div>
            <div className="checkout-box">
              {isWastageMode ? (
                <>
                  <strong>รวมของเสีย {cart.reduce((sum, item) => sum + item.qty, 0)} ชิ้น</strong>
                  <p className="danger-text">รายการนี้จะไม่สร้างยอดขาย และจะบันทึกมูลค่าของเสียจาก FIFO</p>
                </>
              ) : (
                <>
                  <strong>{t(language, "total")} {formatMoney(total)} บาท</strong>
                  <div className="payment-grid">
                    {paymentMethods.map((method) => (
                      <button key={method} className={payment === method ? "active" : ""} onClick={() => setPayment(method)}>{paymentLabel(method)}</button>
                    ))}
                  </div>
                  {payment === "CASH" && (
                    <>
                      <NumpadInput label="เงินสดรับมา (บาท)" value={cashBaht} onChange={setCashBaht} placeholder="แตะเพื่อกรอกเงินรับ" />
                      <b className={cashValid ? "good-text" : "danger-text"}>ทอน {formatMoney(Math.max(0, cashReceived - total))} บาท</b>
                    </>
                  )}
                </>
              )}
              <button className={isWastageMode ? "danger giant" : "primary giant"} disabled={!canFinish} onClick={finishSale}>{isWastageMode ? t(language, "confirmWastage") : t(language, "finishSale")}</button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
