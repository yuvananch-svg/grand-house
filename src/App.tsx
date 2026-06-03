import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Calculator,
  ChefHat,
  ClipboardCheck,
  CreditCard,
  Download,
  Factory,
  FileCheck2,
  History,
  Landmark,
  LogOut,
  LockKeyhole,
  Minus,
  PackagePlus,
  Plus,
  RefreshCcw,
  ReceiptText,
  Save,
  Settings,
  ShieldAlert,
  Store,
  UserRound,
  WalletCards,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { branches, productTypeLabel } from "./data";
import {
  activeLots,
  addCashEntry,
  adjustLot,
  cashIn,
  cashOut,
  closeShift,
  cogs,
  countStock,
  createPosSale,
  createProduct,
  createRecipe,
  expiryAlerts,
  inventoryValue,
  lotStatus,
  money,
  number,
  produceBatch,
  productById,
  receiveLot,
  recipeCost,
  resetState,
  setProductActive,
  stockRevenue,
  today,
  updateTaxSettings,
  voidSale,
} from "./logic";
import { localRepository } from "./repository";
import {
  branchRows,
  channelRows,
  expenseRows,
  exportCsv,
  exportFinancialPdf,
  financialRows,
  maxRows,
  monthlyRows,
  quarterlyRows,
  topProductRows,
  wasteRows,
  yearlyRows,
  ytdRows,
} from "./reporting";
import type { AppState, Branch, PaymentChannel, Product, ProductType, Role } from "./types";

type Page = "dashboard" | "pos" | "salesHistory" | "inventory" | "expiry" | "recipes" | "count" | "cash" | "closeShift" | "financial" | "reconcile" | "settings" | "audit";

const pageItems: { id: Page; label: string; icon: typeof BarChart3; ownerOnly?: boolean }[] = [
  { id: "dashboard", label: "ภาพรวม", icon: BarChart3 },
  { id: "pos", label: "ขายหน้าร้าน", icon: CreditCard },
  { id: "salesHistory", label: "บิลขาย", icon: ReceiptText, ownerOnly: true },
  { id: "inventory", label: "คลังสินค้า", icon: Boxes },
  { id: "expiry", label: "แจ้งเตือนหมดอายุ", icon: ShieldAlert },
  { id: "recipes", label: "สูตรและผลิต", icon: ChefHat },
  { id: "count", label: "นับสต็อก", icon: ClipboardCheck },
  { id: "cash", label: "เงินสดและค่าใช้จ่าย", icon: WalletCards },
  { id: "closeShift", label: "ปิดกะ", icon: FileCheck2 },
  { id: "financial", label: "งบและภาษี", icon: Download, ownerOnly: true },
  { id: "reconcile", label: "ตรวจยอดปิดวัน", icon: Calculator, ownerOnly: true },
  { id: "settings", label: "ตั้งค่า", icon: Settings, ownerOnly: true },
  { id: "audit", label: "ประวัติระบบ", icon: History, ownerOnly: true },
];

const paymentChannels: PaymentChannel[] = ["QR1", "QR2", "เงินสด", "ออนไลน์", "อื่นๆ"];

export function App() {
  const [state, setState] = useState<AppState>(() => localRepository.load());
  const [role, setRole] = useState<Role | null>(null);
  const [page, setPage] = useState<Page>("dashboard");
  const [toast, setToast] = useState("");

  useEffect(() => localRepository.save(state), [state]);

  const visiblePages = useMemo(() => pageItems.filter((item) => role === "owner" || !item.ownerOnly), [role]);

  useEffect(() => {
    if (role && !visiblePages.some((item) => item.id === page)) {
      setPage("dashboard");
    }
  }, [page, role, visiblePages]);

  if (!role) {
    return <LoginScreen onLogin={(nextRole) => setRole(nextRole)} />;
  }

  function commit(next: AppState, message: string) {
    setState(next);
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function fail(message?: string) {
    setToast(message || "บันทึกไม่สำเร็จ");
    window.setTimeout(() => setToast(""), 3000);
  }

  function resetDemo() {
    resetState();
    const next = localRepository.load();
    setState(next);
    setToast("รีเซ็ตข้อมูลตัวอย่างแล้ว");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">GH</div>
          <div>
            <h1>Grand House</h1>
            <p>ระบบคลังและต้นทุน</p>
          </div>
        </div>
        <div className="role-badge">
          {role === "owner" ? <UserRound size={18} /> : <Store size={18} />}
          <span>บทบาท: {role === "owner" ? "เจ้าของ" : "พนักงาน"}</span>
        </div>
        <nav>
          {visiblePages.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={page === item.id ? "nav-active" : ""} onClick={() => setPage(item.id)}>
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <button className="reset-button" onClick={resetDemo}>
          <RefreshCcw size={18} /> รีเซ็ตข้อมูลตัวอย่าง
        </button>
        <button className="reset-button" onClick={() => setRole(null)}>
          <LogOut size={18} /> ออกจากระบบ
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">วันนี้ {today}</p>
            <h2>{pageItems.find((item) => item.id === page)?.label}</h2>
          </div>
          <ExpiryStrip state={state} />
        </header>

        {toast && <div className={toast.includes("ไม่") || toast.includes("หมดอายุ") ? "toast error" : "toast"}>{toast}</div>}

        {page === "dashboard" && <Dashboard state={state} role={role} />}
        {page === "pos" && <PosPage state={state} commit={commit} fail={fail} />}
        {page === "salesHistory" && <SalesHistoryPage state={state} commit={commit} fail={fail} />}
        {page === "inventory" && <Inventory state={state} commit={commit} fail={fail} />}
        {page === "expiry" && <ExpiryCenter state={state} commit={commit} fail={fail} />}
        {page === "recipes" && <Recipes state={state} commit={commit} fail={fail} />}
        {page === "count" && <StockCount state={state} commit={commit} fail={fail} />}
        {page === "cash" && <CashPage state={state} commit={commit} />}
        {page === "closeShift" && <CloseShiftPage state={state} commit={commit} />}
        {page === "financial" && <FinancialPage state={state} />}
        {page === "reconcile" && <Reconcile state={state} />}
        {page === "settings" && <SettingsPage state={state} commit={commit} />}
        {page === "audit" && <AuditPage state={state} />}
      </main>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (role: Role) => void }) {
  const [selectedRole, setSelectedRole] = useState<Role>("staff");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const expected = selectedRole === "owner" ? "1234" : "1111";
    if (pin !== expected) {
      setError("PIN ไม่ถูกต้อง");
      return;
    }
    onLogin(selectedRole);
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand login-brand">
          <div className="brand-mark">GH</div>
          <div>
            <h1>Grand House</h1>
            <p>เข้าสู่ระบบ POS และคลังสินค้า</p>
          </div>
        </div>
        <form className="login-form" onSubmit={submit}>
          <div className="role-switch login-role">
            <button type="button" className={selectedRole === "staff" ? "active" : ""} onClick={() => setSelectedRole("staff")}>
              <Store size={18} /> พนักงาน
            </button>
            <button type="button" className={selectedRole === "owner" ? "active" : ""} onClick={() => setSelectedRole("owner")}>
              <UserRound size={18} /> เจ้าของ
            </button>
          </div>
          <label>
            <span>PIN</span>
            <input value={pin} inputMode="numeric" maxLength={6} onChange={(event) => setPin(event.target.value)} placeholder="พนักงาน 1111 / เจ้าของ 1234" />
          </label>
          {error && <p className="login-error">{error}</p>}
          <button className="primary action" type="submit">
            <LockKeyhole size={18} /> เข้าสู่ระบบ
          </button>
          <p className="login-note">PIN นี้ใช้สำหรับ prototype ในเครื่องเท่านั้น ระบบจริงต้องใช้ Supabase Auth และ RLS</p>
        </form>
      </section>
    </main>
  );
}

function ExpiryStrip({ state }: { state: AppState }) {
  const alerts = expiryAlerts(state);
  const expired = alerts.filter((item) => item.status === "หมดอายุ").length;
  const near = alerts.filter((item) => item.status === "ใกล้หมดอายุ").length;
  return (
    <div className="expiry-strip">
      <AlertTriangle size={18} />
      <span>หมดอายุ {expired}</span>
      <span>ใกล้หมดอายุ {near}</span>
    </div>
  );
}

function Dashboard({ state, role }: { state: AppState; role: Role }) {
  const revenue = stockRevenue(state);
  const cost = cogs(state);
  const alerts = expiryAlerts(state);
  const stockValue = inventoryValue(state);
  const totalCashIn = cashIn(state);
  const totalCashOut = cashOut(state);
  const daily = financialRows(state, "day");
  const monthly = monthlyRows(state);
  const quarterly = quarterlyRows(state);
  const yearly = yearlyRows(state);
  const ytd = ytdRows(state);
  const max = maxRows(state);
  const channels = channelRows(state);
  const byBranch = branchRows(state);
  const topProducts = topProductRows(state);
  const expenses = expenseRows(state);
  const waste = wasteRows(state);
  return (
    <section className="stack">
      {role === "staff" && (
        <div className="quick-grid">
          <Quick label="รับสินค้าเข้า" icon={PackagePlus} />
          <Quick label="ผลิตอาหาร" icon={Factory} />
          <Quick label="นับของเหลือ" icon={ClipboardCheck} />
          <Quick label="บันทึกเงิน" icon={Landmark} />
        </div>
      )}
      <div className="metric-grid">
        <Metric label="ยอดขายรวม" value={money(revenue)} />
        <Metric label="ต้นทุนขาย" value={money(cost)} />
        <Metric label="กำไรขั้นต้น" value={money(revenue - cost)} intent={revenue - cost < 0 ? "danger" : "good"} />
        <Metric label="มูลค่าคลัง" value={money(stockValue)} />
        <Metric label="เงินเข้า" value={money(totalCashIn)} intent="good" />
        <Metric label="เงินออก" value={money(totalCashOut)} intent="danger" />
      </div>
      <div className="chart-grid wide">
        <ChartPanel title="ยอดขายและกำไรตามวัน" icon={BarChart3}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(value) => money(Number(value))} />
              <Legend />
              <Area type="monotone" dataKey="revenue" name="ยอดขาย" stroke="#b5121b" fill="#f6c8cc" />
              <Line type="monotone" dataKey="grossProfit" name="กำไรขั้นต้น" stroke="#18764a" strokeWidth={2} />
              <Line type="monotone" dataKey="netProfit" name="กำไรสุทธิ" stroke="#7d0c14" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="สัดส่วนช่องทางรับเงิน" icon={CreditCard}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={channels} dataKey="value" nameKey="name" outerRadius={92} label>
                {channels.map((_, index) => (
                  <Cell key={index} fill={["#b5121b", "#d94b54", "#f2a0a7", "#18764a", "#aa5b00"][index % 5]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => money(Number(value))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>
      <div className="chart-grid">
        <ChartPanel title="ยอดขายรายเดือน" icon={BarChart3}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(value) => money(Number(value))} />
              <Bar dataKey="revenue" name="ยอดขาย" fill="#b5121b" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="กำไรตามไตรมาส" icon={BarChart3}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={quarterly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(value) => money(Number(value))} />
              <Legend />
              <Bar dataKey="revenue" name="ยอดขาย" fill="#b5121b" />
              <Bar dataKey="cogs" name="ต้นทุนขาย" fill="#f2a0a7" />
              <Bar dataKey="netProfit" name="กำไรสุทธิ" fill="#18764a" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="ยอดขายสะสม YTD" icon={BarChart3}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={ytd}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(value) => money(Number(value))} />
              <Line type="monotone" dataKey="revenue" name="ยอดขายสะสม" stroke="#b5121b" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="ภาพรวมตั้งแต่เปิดร้าน" icon={BarChart3}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={max}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(value) => money(Number(value))} />
              <Legend />
              <Bar dataKey="revenue" name="ยอดขายทั้งหมด" fill="#b5121b" />
              <Bar dataKey="netProfit" name="กำไรสุทธิ" fill="#18764a" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="ยอดขายแยกสาขา" icon={Store}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byBranch}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(value) => money(Number(value))} />
              <Legend />
              <Bar dataKey="บ้านโจ้" stackId="branch" fill="#b5121b" />
              <Bar dataKey="ท่ารั้ว" stackId="branch" fill="#d94b54" />
              <Bar dataKey="เกษตรใหม่" stackId="branch" fill="#f2a0a7" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="ต้นทุนและค่าใช้จ่ายตามหมวด" icon={WalletCards}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={expenses} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={110} />
              <Tooltip formatter={(value) => money(Number(value))} />
              <Bar dataKey="value" name="จำนวนเงิน" fill="#7d0c14" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="สินค้าและเมนูทำกำไรสูงสุด" icon={ChefHat}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={140} />
              <Tooltip formatter={(value) => money(Number(value))} />
              <Bar dataKey="grossProfit" name="กำไรขั้นต้น" fill="#18764a" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="ของเสียและหมดอายุ" icon={ShieldAlert}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={waste}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(value) => money(Number(value))} />
              <Bar dataKey="value" name="มูลค่าของเสีย" fill="#aa5b00" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="ยอดขายรายปี" icon={BarChart3}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={yearly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(value) => money(Number(value))} />
              <Bar dataKey="revenue" name="ยอดขาย" fill="#b5121b" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>
      <div className="two-col">
        <Panel title="ของที่ต้องรีบจัดการ" icon={ShieldAlert}>
          <SimpleTable
            headers={["สินค้า", "LOT", "สาขา", "เหลือ", "สถานะ"]}
            rows={alerts.slice(0, 8).map((item) => [
              item.product.name,
              item.lot.id,
              item.lot.branch,
              `${number(item.lot.remaining, 2)} ${item.product.unit}`,
              <Badge key={item.lot.id} status={item.status} />,
            ])}
            empty="ยังไม่มีรายการใกล้หมดอายุ"
          />
        </Panel>
        <Panel title="ยอดขายล่าสุดจากการนับสต็อก" icon={ClipboardCheck}>
          <SimpleTable
            headers={["วันที่", "สินค้า", "ขาย", "รายได้", "ต้นทุน"]}
            rows={state.sessions.slice(-8).reverse().map((session) => {
              const product = productById(state.products, session.productId);
              return [session.date, product?.name || "-", number(session.normalSold + session.promoSold), money(session.revenue), money(session.costOfGoods)];
            })}
            empty="ยังไม่มีการนับสต็อก"
          />
        </Panel>
      </div>
    </section>
  );
}

function PosPage({ state, commit, fail }: { state: AppState; commit: (next: AppState, message: string) => void; fail: (message?: string) => void }) {
  const saleProducts = state.products.filter((product) => product.active && (product.type === "purchased_finished_good" || product.type === "produced_finished_good"));
  const [cart, setCart] = useState<Array<{ productId: string; quantity: number; unitPrice: number; discount: number }>>([]);
  const [paymentAmounts, setPaymentAmounts] = useState<Record<PaymentChannel, number>>({ QR1: 0, QR2: 0, เงินสด: 0, ออนไลน์: 0, อื่นๆ: 0 });
  const [paymentTouched, setPaymentTouched] = useState(false);
  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discount, 0), [cart]);
  const paidTotal = useMemo(() => paymentChannels.reduce((sum, channel) => sum + paymentAmounts[channel], 0), [paymentAmounts]);
  const paymentDiff = paidTotal - cartTotal;

  useEffect(() => {
    if (!paymentTouched) {
      setPaymentAmounts({ QR1: cartTotal, QR2: 0, เงินสด: 0, ออนไลน์: 0, อื่นๆ: 0 });
    }
  }, [cartTotal, paymentTouched]);

  function addProduct(product: Product) {
    const available = activeLots(state, (lot) => lot.productId === product.id && lotStatus(lot) !== "หมดอายุ").reduce((sum, lot) => sum + lot.remaining, 0);
    if (available <= 0) return fail(`${product.name} ไม่มีสต็อกที่ขายได้`);
    setCart((items) => {
      const current = items.find((item) => item.productId === product.id);
      if (current) return items.map((item) => (item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      return [...items, { productId: product.id, quantity: 1, unitPrice: product.salePrice || 0, discount: 0 }];
    });
  }

  function updateCart(productId: string, key: "quantity" | "unitPrice" | "discount", value: number) {
    setCart((items) => items.map((item) => (item.productId === productId ? { ...item, [key]: Math.max(0, value) } : item)).filter((item) => item.quantity > 0));
  }

  function useQuickPayment(channel: PaymentChannel) {
    setPaymentTouched(true);
    setPaymentAmounts({ QR1: 0, QR2: 0, เงินสด: 0, ออนไลน์: 0, อื่นๆ: 0, [channel]: cartTotal });
  }

  function updatePayment(channel: PaymentChannel, value: number) {
    setPaymentTouched(true);
    setPaymentAmounts((current) => ({ ...current, [channel]: Math.max(0, value) }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = createPosSale(state, {
      date: String(form.get("date")),
      branch: form.get("branch") as Branch,
      payments: paymentAmounts,
      items: cart,
      note: String(form.get("note")),
    });
    if (result.error) return fail(result.error);
    setCart([]);
    setPaymentAmounts({ QR1: 0, QR2: 0, เงินสด: 0, ออนไลน์: 0, อื่นๆ: 0 });
    setPaymentTouched(false);
    commit(result.state, "บันทึกบิล POS แล้ว");
  }

  return (
    <section className="pos-layout">
      <Panel title="เลือกสินค้า" icon={Store}>
        <div className="product-grid">
          {saleProducts.map((product) => {
            const available = activeLots(state, (lot) => lot.productId === product.id && lotStatus(lot) !== "หมดอายุ").reduce((sum, lot) => sum + lot.remaining, 0);
            return (
              <button className="product-button" key={product.id} onClick={() => addProduct(product)}>
                <strong>{product.name}</strong>
                <span>{money(product.salePrice || 0)} · เหลือ {number(available, 2)}</span>
              </button>
            );
          })}
        </div>
      </Panel>
      <Panel title="ตะกร้าขายหน้าร้าน" icon={CreditCard}>
        <form className="stack" onSubmit={submit}>
          <div className="clean-form pos-meta">
            <Input name="date" label="วันที่ขาย" type="date" defaultValue={today} />
            <Select name="branch" label="สาขา" options={branches.map((branch) => [branch, branch])} />
            <Input name="note" label="หมายเหตุ" defaultValue="ขายหน้าร้าน" />
          </div>
          <SimpleTable
            headers={["สินค้า", "จำนวน", "ราคา", "ส่วนลด", "รวม"]}
            rows={cart.map((item) => {
              const product = productById(state.products, item.productId);
              return [
                product?.name || item.productId,
                <input key="qty" className="mini-input" type="number" min="0" step="1" value={item.quantity} onChange={(event) => updateCart(item.productId, "quantity", Number(event.target.value))} />,
                <input key="price" className="mini-input" type="number" min="0" step="1" value={item.unitPrice} onChange={(event) => updateCart(item.productId, "unitPrice", Number(event.target.value))} />,
                <input key="discount" className="mini-input" type="number" min="0" step="1" value={item.discount} onChange={(event) => updateCart(item.productId, "discount", Number(event.target.value))} />,
                money(item.quantity * item.unitPrice - item.discount),
              ];
            })}
            empty="ยังไม่มีสินค้าในตะกร้า"
          />
          <div className="pos-total">
            <span>ยอดรวม</span>
            <strong>{money(cartTotal)}</strong>
          </div>
          <div className="payment-box">
            <div className="payment-header">
              <strong>รับเงิน</strong>
              <span className={Math.abs(paymentDiff) <= 0.01 ? "good-text" : "danger-text"}>ส่วนต่าง {money(paymentDiff)}</span>
            </div>
            <div className="quick-pay-row">
              {paymentChannels.map((channel) => (
                <button key={channel} className="chip" type="button" onClick={() => useQuickPayment(channel)}>
                  ทั้งหมด {channel}
                </button>
              ))}
            </div>
            <div className="payment-grid">
              {paymentChannels.map((channel) => (
                <label key={channel}>
                  <span>{channel}</span>
                  <input type="number" min="0" step="0.01" value={paymentAmounts[channel]} onChange={(event) => updatePayment(channel, Number(event.target.value))} />
                </label>
              ))}
            </div>
          </div>
          <button className="primary action" type="submit">
            <Save size={18} /> บันทึกบิล POS
          </button>
        </form>
      </Panel>
    </section>
  );
}

function SalesHistoryPage({ state, commit, fail }: { state: AppState; commit: (next: AppState, message: string) => void; fail: (message?: string) => void }) {
  const [saleId, setSaleId] = useState(state.sales.at(-1)?.id || "");
  const [reason, setReason] = useState("คีย์บิลผิด");
  const saleOptions = state.sales
    .slice()
    .reverse()
    .map((sale) => [sale.id, `${sale.documentNo} · ${sale.branch} · ${money(sale.total)} · ${sale.status || "ปกติ"}`] as [string, string]);

  function paymentSummary(targetSaleId: string) {
    const rows = state.payments.filter((payment) => payment.saleId === targetSaleId && payment.amount > 0);
    if (rows.length === 0) return "-";
    return rows.map((payment) => `${payment.channel} ${money(payment.amount)}`).join(", ");
  }

  function submitVoid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = voidSale(state, { saleId, date: today, reason });
    if (result.error) return fail(result.error);
    commit(result.state, "ยกเลิกบิลและคืนสต็อกแล้ว");
  }

  return (
    <section className="stack">
      <Panel title="ยกเลิกบิลขาย" icon={ReceiptText}>
        <form className="clean-form void-sale-form" onSubmit={submitVoid}>
          <Select name="saleId" label="เลือกบิล" value={saleId} onChange={(event) => setSaleId(event.target.value)} options={saleOptions} />
          <Input name="reason" label="เหตุผล" value={reason} onChange={(event) => setReason(event.target.value)} />
          <button className="primary action" type="submit">
            <RefreshCcw size={18} /> ยกเลิกและคืนสต็อก
          </button>
        </form>
      </Panel>
      <Panel title="ประวัติบิลขายล่าสุด" icon={ReceiptText}>
        <SimpleTable
          headers={["เลขบิล", "วันที่", "สาขา", "ยอดขาย", "ต้นทุน", "กำไร", "รับเงิน", "สถานะ", "หมายเหตุ"]}
          rows={state.sales.slice(-24).reverse().map((sale) => [
            sale.documentNo,
            sale.date,
            sale.branch,
            money(sale.total),
            money(sale.costOfGoods),
            money(sale.grossProfit),
            paymentSummary(sale.id),
            <Badge key={`${sale.id}-status`} status={sale.status || "ปกติ"} />,
            sale.voidReason || sale.note || "-",
          ])}
          empty="ยังไม่มีบิลขาย"
        />
      </Panel>
    </section>
  );
}

function Inventory({ state, commit, fail }: { state: AppState; commit: (next: AppState, message: string) => void; fail: (message?: string) => void }) {
  const [filter, setFilter] = useState<Product["type"] | "all">("all");
  const products = state.products.filter((product) => product.type !== "produced_finished_good" || true);
  const visibleLots = state.lots.filter((lot) => {
    const product = productById(state.products, lot.productId);
    return filter === "all" || product?.type === filter;
  });

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = createProduct(state, {
      name: String(form.get("name")),
      type: form.get("type") as ProductType,
      category: String(form.get("category")),
      unit: String(form.get("unit")),
      salePrice: Number(form.get("salePrice")),
      supplier: String(form.get("supplier")),
    });
    if (result.error) return fail(result.error);
    event.currentTarget.reset();
    commit(result.state, "เพิ่มรายการสินค้าแล้ว");
  }

  function toggleProduct(productId: string, active: boolean) {
    commit(setProductActive(state, productId, active), active ? "เปิดใช้งานสินค้าแล้ว" : "ปิดใช้งานสินค้าแล้ว");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const quantity = Number(form.get("quantity"));
    const unitCost = Number(form.get("unitCost"));
    if (quantity <= 0 || unitCost < 0) return fail("จำนวนหรือต้นทุนไม่ถูกต้อง");
    const next = receiveLot(state, {
      productId: String(form.get("productId")),
      branch: form.get("branch") as Branch,
      quantity,
      unitCost,
      receivedDate: String(form.get("receivedDate")),
      expiryDate: String(form.get("expiryDate")),
      supplier: String(form.get("supplier")),
      note: String(form.get("note")),
    });
    event.currentTarget.reset();
    commit(next, "รับสินค้าเข้าแล้ว");
  }

  function submitAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const direction = String(form.get("direction"));
    const amount = Number(form.get("adjustQty"));
    if (amount <= 0) return fail("จำนวนปรับสต็อกต้องมากกว่า 0");
    const result = adjustLot(state, {
      lotId: String(form.get("lotId")),
      date: String(form.get("date")),
      quantityChange: direction === "ลด" ? -amount : amount,
      reason: String(form.get("reason")),
      markWaste: form.get("markWaste") === "on",
    });
    if (result.error) return fail(result.error);
    event.currentTarget.reset();
    commit(result.state, "ปรับสต็อกแล้ว");
  }

  return (
    <section className="stack">
      <Panel title="เพิ่มสินค้า วัตถุดิบ หรือเมนูใหม่" icon={PackagePlus}>
        <form className="clean-form product-form" onSubmit={submitProduct}>
          <Input name="name" label="ชื่อรายการ" placeholder="เช่น หมูกรอบ / น้ำพริก / ข้าวกล่องใหม่" />
          <Select
            name="type"
            label="ประเภท"
            options={[
              ["raw_material", "วัตถุดิบ"],
              ["packaging", "บรรจุภัณฑ์"],
              ["purchased_finished_good", "ซื้อมาขาย"],
              ["produced_finished_good", "เมนูผลิตเอง"],
            ]}
          />
          <Input name="category" label="หมวด" defaultValue="อาหาร" />
          <Input name="unit" label="หน่วยนับ" defaultValue="ชิ้น" />
          <Input name="salePrice" label="ราคาขาย (ถ้ามี)" type="number" step="0.01" defaultValue="0" />
          <Input name="supplier" label="ผู้ขาย/แหล่งซื้อ" defaultValue="The Grand's" />
          <button className="primary action" type="submit">
            <Save size={18} /> เพิ่มรายการ
          </button>
        </form>
      </Panel>
      <Panel title="รายการสินค้าและวัตถุดิบทั้งหมด" icon={Boxes}>
        <SimpleTable
          headers={["รหัส", "ชื่อ", "ประเภท", "หมวด", "หน่วย", "ราคาขาย", "สถานะ", "จัดการ"]}
          rows={state.products.map((product) => [
            product.id,
            product.name,
            productTypeLabel[product.type],
            product.category,
            product.unit,
            product.salePrice ? money(product.salePrice) : "-",
            <Badge key={`${product.id}-status`} status={product.active ? "ปกติ" : "ปิดใช้งาน"} />,
            <button key={`${product.id}-toggle`} className="small-danger" onClick={() => toggleProduct(product.id, !product.active)}>
              {product.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
            </button>,
          ])}
        />
      </Panel>
      <Panel title="รับสินค้าเข้าคลัง" icon={PackagePlus}>
        <form className="clean-form" onSubmit={submit}>
          <Select name="productId" label="สินค้า" options={products.map((product) => [product.id, `${product.name} (${productTypeLabel[product.type]})`])} />
          <Select name="branch" label="สาขา" options={branches.map((branch) => [branch, branch])} />
          <Input name="quantity" label="จำนวน" type="number" step="0.01" defaultValue="10" />
          <Input name="unitCost" label="ต้นทุนต่อหน่วย" type="number" step="0.01" defaultValue="25" />
          <Input name="receivedDate" label="วันที่รับเข้า" type="date" defaultValue={today} />
          <Input name="expiryDate" label="วันหมดอายุ" type="date" defaultValue="2026-06-04" />
          <Input name="supplier" label="ผู้ขาย/แหล่งซื้อ" defaultValue="The Grand's" />
          <Input name="note" label="หมายเหตุ" defaultValue="รับสินค้าเข้า" />
          <button className="primary action" type="submit">
            <Save size={18} /> บันทึกรับเข้า
          </button>
        </form>
      </Panel>
      <Panel title="ปรับสต็อกมือ" icon={ClipboardCheck}>
        <form className="clean-form adjustment-form" onSubmit={submitAdjustment}>
          <Select
            name="lotId"
            label="เลือก LOT"
            options={activeLots(state).map((lot) => {
              const product = productById(state.products, lot.productId);
              return [lot.id, `${lot.id} · ${product?.name} · เหลือ ${number(lot.remaining, 2)} ${product?.unit || ""}`];
            })}
          />
          <Input name="date" label="วันที่" type="date" defaultValue={today} />
          <Select name="direction" label="ประเภท" options={[["ลด", "ลด"], ["เพิ่ม", "เพิ่ม"]]} />
          <Input name="adjustQty" label="จำนวน" type="number" step="0.01" defaultValue="1" />
          <Input name="reason" label="เหตุผล" defaultValue="นับคลังจริงไม่ตรงระบบ" />
          <label className="checkline">
            <input name="markWaste" type="checkbox" />
            <span>ตัดเสียเมื่อยอดเหลือเป็น 0</span>
          </label>
          <button className="primary action" type="submit">
            <Save size={18} /> บันทึกปรับสต็อก
          </button>
        </form>
      </Panel>
      <Panel title="รายการคงเหลือแยก LOT" icon={Boxes}>
        <div className="filter-row">
          {(["all", "raw_material", "packaging", "purchased_finished_good", "produced_finished_good"] as const).map((item) => (
            <button key={item} className={filter === item ? "chip active" : "chip"} onClick={() => setFilter(item)}>
              {item === "all" ? "ทั้งหมด" : productTypeLabel[item]}
            </button>
          ))}
        </div>
        <LotsTable state={state} lots={visibleLots} />
      </Panel>
    </section>
  );
}

function ExpiryCenter({ state, commit, fail }: { state: AppState; commit: (next: AppState, message: string) => void; fail: (message?: string) => void }) {
  const alerts = expiryAlerts(state);
  function markWaste(lotId: string) {
    const lot = state.lots.find((item) => item.id === lotId);
    if (!lot) return fail("ไม่พบ LOT");
    const result = adjustLot(state, { lotId, date: today, quantityChange: -lot.remaining, reason: "ตัดเสียจากวันหมดอายุ", markWaste: true });
    if (result.error) return fail(result.error);
    commit(result.state, "ตัดเสียแล้ว");
  }
  return (
    <Panel title="รายการใกล้หมดอายุและหมดอายุ" icon={ShieldAlert}>
      <SimpleTable
        headers={["สินค้า", "LOT", "สาขา", "หมดอายุ", "เหลือ", "สถานะ", "จัดการ"]}
        rows={alerts.map((item) => [
          item.product.name,
          item.lot.id,
          item.lot.branch,
          item.lot.expiryDate,
          `${number(item.lot.remaining, 2)} ${item.product.unit}`,
          <Badge key={`${item.lot.id}-badge`} status={item.status} />,
          <button key={`${item.lot.id}-button`} className="small-danger" onClick={() => markWaste(item.lot.id)}>
            ตัดเสีย
          </button>,
        ])}
        empty="ไม่มีรายการต้องเตือน"
      />
    </Panel>
  );
}

function Recipes({ state, commit, fail }: { state: AppState; commit: (next: AppState, message: string) => void; fail: (message?: string) => void }) {
  const rawProducts = state.products.filter((product) => product.type === "raw_material" || product.type === "packaging");
  const outputProducts = state.products.filter((product) => product.type === "produced_finished_good");
  const [ingredientRows, setIngredientRows] = useState([1, 2, 3]);

  function submitBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = produceBatch(state, {
      recipeId: String(form.get("recipeId")),
      branch: form.get("branch") as Branch,
      producedQty: Number(form.get("producedQty")),
      productionDate: String(form.get("productionDate")),
      expiryDate: String(form.get("expiryDate")),
    });
    if (result.error) return fail(result.error);
    event.currentTarget.reset();
    commit(result.state, "ผลิต batch แล้ว");
  }

  function submitRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ingredients = ingredientRows.map((index) => {
      const productId = String(form.get(`ingredient${index}`));
      const product = productById(state.products, productId);
      return {
        productId,
        quantity: Number(form.get(`ingredientQty${index}`)),
        unit: product?.unit || "",
      };
    });
    const result = createRecipe(state, {
      name: String(form.get("recipeName")),
      outputProductId: String(form.get("outputProductId")),
      outputQty: Number(form.get("outputQty")),
      ingredients,
    });
    if (result.error) return fail(result.error);
    event.currentTarget.reset();
    setIngredientRows([1, 2, 3]);
    commit(result.state, "บันทึกสูตรอาหารแล้ว");
  }

  function addIngredientRow() {
    setIngredientRows((rows) => [...rows, Math.max(...rows) + 1]);
  }

  function removeIngredientRow(rowId: number) {
    setIngredientRows((rows) => (rows.length <= 1 ? rows : rows.filter((row) => row !== rowId)));
  }

  return (
    <section className="stack">
      <div className="recipe-grid">
        {state.recipes.map((recipe) => {
          const cost = recipeCost(state, recipe);
          const output = productById(state.products, recipe.outputProductId);
          return (
            <article className="recipe-card" key={recipe.id}>
              <div>
                <p className="eyebrow">{recipe.id}</p>
                <h3>{recipe.name}</h3>
                <p>ได้ {recipe.outputQty} {recipe.outputUnit} · สินค้า {output?.name}</p>
              </div>
              <strong>{money(cost.perUnit)} / กล่อง</strong>
              {cost.missing.length > 0 && <span className="warning-text">ขาด: {cost.missing.join(", ")}</span>}
            </article>
          );
        })}
      </div>
      <Panel title="บันทึกสูตรอาหารใหม่" icon={ChefHat}>
        <form className="clean-form recipe-form" onSubmit={submitRecipe}>
          <Input name="recipeName" label="ชื่อสูตร" defaultValue="สูตรตัวอย่างใหม่" />
          <Select name="outputProductId" label="เมนูที่ผลิตได้" options={outputProducts.map((product) => [product.id, product.name])} />
          <Input name="outputQty" label="จำนวนที่ได้" type="number" step="0.01" defaultValue="10" />
          {ingredientRows.map((index, visibleIndex) => (
            <div className="ingredient-row" key={index}>
              <Select name={`ingredient${index}`} label={`วัตถุดิบ ${visibleIndex + 1}`} options={rawProducts.map((product) => [product.id, `${product.name} (${product.unit})`])} />
              <Input name={`ingredientQty${index}`} label="จำนวนที่ใช้" type="number" step="0.01" defaultValue={index === 1 ? "1" : "0"} />
              <button className="icon-button danger-soft" type="button" onClick={() => removeIngredientRow(index)} aria-label={`ลบวัตถุดิบ ${visibleIndex + 1}`}>
                <Minus size={18} />
              </button>
            </div>
          ))}
          <button className="secondary action" type="button" onClick={addIngredientRow}>
            <Plus size={18} /> เพิ่มวัตถุดิบ
          </button>
          <button className="primary action" type="submit">
            <Save size={18} /> บันทึกสูตร
          </button>
        </form>
      </Panel>
      <Panel title="ผลิตอาหารเป็น batch" icon={Factory}>
        <form className="clean-form" onSubmit={submitBatch}>
          <Select name="recipeId" label="สูตรอาหาร" options={state.recipes.map((recipe) => [recipe.id, recipe.name])} />
          <Select name="branch" label="สาขา" options={branches.map((branch) => [branch, branch])} />
          <Input name="producedQty" label="จำนวนที่ผลิต" type="number" defaultValue="20" />
          <Input name="productionDate" label="วันที่ผลิต" type="date" defaultValue={today} />
          <Input name="expiryDate" label="วันหมดอายุ" type="date" defaultValue="2026-06-04" />
          <button className="primary action" type="submit">
            <Factory size={18} /> บันทึกการผลิต
          </button>
        </form>
      </Panel>
    </section>
  );
}

function StockCount({ state, commit, fail }: { state: AppState; commit: (next: AppState, message: string) => void; fail: (message?: string) => void }) {
  const saleLots = activeLots(state, (lot) => {
    const product = productById(state.products, lot.productId);
    return product?.type === "purchased_finished_good" || product?.type === "produced_finished_good";
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = countStock(state, {
      lotId: String(form.get("lotId")),
      date: String(form.get("date")),
      countedRemaining: Number(form.get("countedRemaining")),
      giveawayQty: Number(form.get("giveawayQty")),
      wasteQty: Number(form.get("wasteQty")),
      promoSold: Number(form.get("promoSold")),
      promoPrice: Number(form.get("promoPrice")),
      note: String(form.get("note")),
    });
    if (result.error) return fail(result.error);
    event.currentTarget.reset();
    commit(result.state, "บันทึกนับสต็อกแล้ว");
  }
  return (
    <section className="stack">
      <Panel title="นับของเหลือ" icon={ClipboardCheck}>
        <form className="clean-form count-form" onSubmit={submit}>
          <Select
            name="lotId"
            label="เลือก LOT"
            options={saleLots.map((lot) => {
              const product = productById(state.products, lot.productId);
              return [lot.id, `${lot.id} · ${product?.name} · เหลือ ${number(lot.remaining, 2)} · ${lot.branch}`];
            })}
          />
          <Input name="date" label="วันที่นับ" type="date" defaultValue={today} />
          <Input name="countedRemaining" label="เหลือครั้งนี้" type="number" step="0.01" defaultValue="0" />
          <Input name="giveawayQty" label="แถม" type="number" step="0.01" defaultValue="0" />
          <Input name="wasteQty" label="เสีย" type="number" step="0.01" defaultValue="0" />
          <Input name="promoSold" label="ขายราคาพิเศษ" type="number" step="0.01" defaultValue="0" />
          <Input name="promoPrice" label="ราคาพิเศษ" type="number" step="0.01" defaultValue="0" />
          <Input name="note" label="หมายเหตุ" defaultValue="นับปิดวัน" />
          <button className="primary action" type="submit">
            <Save size={18} /> บันทึก
          </button>
        </form>
      </Panel>
      <Panel title="LOT พร้อมขาย" icon={Store}>
        <LotsTable state={state} lots={saleLots} />
      </Panel>
    </section>
  );
}

function CashPage({ state, commit }: { state: AppState; commit: (next: AppState, message: string) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = addCashEntry(state, {
      date: String(form.get("date")),
      branch: form.get("branch") as Branch,
      type: form.get("type") as "รับเงิน" | "จ่ายเงิน",
      category: String(form.get("category")),
      amount: Number(form.get("amount")),
      note: String(form.get("note")),
    });
    event.currentTarget.reset();
    commit(next, "บันทึกเงินแล้ว");
  }
  return (
    <section className="stack">
      <Panel title="บันทึกเงินสดและค่าใช้จ่าย" icon={WalletCards}>
        <form className="clean-form" onSubmit={submit}>
          <Input name="date" label="วันที่" type="date" defaultValue={today} />
          <Select name="branch" label="สาขา" options={branches.map((branch) => [branch, branch])} />
          <Select name="type" label="ประเภท" options={[["รับเงิน", "รับเงิน"], ["จ่ายเงิน", "จ่ายเงิน"]]} />
          <Input name="category" label="หมวด" defaultValue="ยอดขายจริง" />
          <Input name="amount" label="จำนวนเงิน" type="number" defaultValue="1000" />
          <Input name="note" label="หมายเหตุ" defaultValue="บันทึกยอดประจำวัน" />
          <button className="primary action" type="submit">
            <Save size={18} /> บันทึกเงิน
          </button>
        </form>
      </Panel>
      <Panel title="รายการเงินล่าสุด" icon={Landmark}>
        <SimpleTable
          headers={["วันที่", "สาขา", "ประเภท", "หมวด", "จำนวน", "หมายเหตุ"]}
          rows={state.cashEntries.slice(-12).reverse().map((entry) => [entry.date, entry.branch, entry.type, entry.category, money(entry.amount), entry.note])}
        />
      </Panel>
    </section>
  );
}

function CloseShiftPage({ state, commit }: { state: AppState; commit: (next: AppState, message: string) => void }) {
  const channels: PaymentChannel[] = ["QR1", "QR2", "เงินสด", "ออนไลน์", "อื่นๆ"];
  const [date, setDate] = useState(today);
  const [branch, setBranch] = useState<Branch>("บ้านโจ้");
  const expectedByChannel = channels.map((channel) => ({
    channel,
    amount: state.payments.filter((payment) => payment.date === date && payment.branch === branch && payment.channel === channel).reduce((sum, payment) => sum + payment.amount, 0),
  }));
  const expectedTotal = expectedByChannel.reduce((sum, row) => sum + row.amount, 0);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const actualByChannel = channels.reduce(
      (acc, channel) => ({ ...acc, [channel]: Number(form.get(channel)) || 0 }),
      {} as Record<PaymentChannel, number>,
    );
    const next = closeShift(state, {
      date,
      branch,
      actualByChannel,
      note: String(form.get("note")),
    });
    event.currentTarget.reset();
    commit(next, "บันทึกปิดกะแล้ว");
  }

  return (
    <section className="stack">
      <div className="metric-grid">
        <Metric label="ยอดตามระบบ POS" value={money(expectedTotal)} />
        <Metric label="จำนวนบิล" value={`${number(state.sales.filter((sale) => sale.date === date && sale.branch === branch).length)} บิล`} />
        <Metric label="รอบที่ปิดแล้ว" value={`${number(state.closeShifts.filter((shift) => shift.date === date && shift.branch === branch).length)} ครั้ง`} />
      </div>
      <Panel title="ปิดกะและเทียบยอดเงินจริง" icon={FileCheck2}>
        <form className="clean-form close-shift-form" onSubmit={submit}>
          <Input name="date" label="วันที่" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <Select name="branch" label="สาขา" value={branch} onChange={(event) => setBranch(event.target.value as Branch)} options={branches.map((item) => [item, item])} />
          {channels.map((channel) => (
            <Input key={`${date}-${branch}-${channel}`} name={channel} label={`เงินจริง ${channel}`} type="number" step="0.01" defaultValue={String(expectedByChannel.find((row) => row.channel === channel)?.amount || 0)} />
          ))}
          <Input name="note" label="หมายเหตุ" defaultValue="ปิดกะประจำวัน" />
          <button className="primary action" type="submit">
            <Save size={18} /> บันทึกปิดกะ
          </button>
        </form>
      </Panel>
      <Panel title="ยอดตามระบบแยกช่องทาง" icon={CreditCard}>
        <SimpleTable headers={["ช่องทาง", "ยอดตามระบบ"]} rows={expectedByChannel.map((row) => [row.channel, money(row.amount)])} />
      </Panel>
      <Panel title="ประวัติปิดกะล่าสุด" icon={FileCheck2}>
        <SimpleTable
          headers={["เลขเอกสาร", "วันที่", "สาขา", "ยอดระบบ", "เงินจริง", "ส่วนต่าง", "หมายเหตุ"]}
          rows={state.closeShifts.slice(-12).reverse().map((shift) => [
            shift.documentNo,
            shift.date,
            shift.branch,
            money(shift.expectedTotal),
            money(shift.actualTotal),
            <span key={shift.id} className={Math.abs(shift.difference) <= 20 ? "good-text" : "danger-text"}>{money(shift.difference)}</span>,
            shift.note,
          ])}
          empty="ยังไม่มีการปิดกะ"
        />
      </Panel>
    </section>
  );
}

function FinancialPage({ state }: { state: AppState }) {
  const monthRows = monthlyRows(state);
  const yearRows = yearlyRows(state);
  const [fromDate, setFromDate] = useState("2026-06-01");
  const [toDate, setToDate] = useState(today);
  const [branch, setBranch] = useState<Branch | "all">("all");
  const [docType, setDocType] = useState<string>("all");
  const docs = state.documents.filter((doc) => {
    const inDate = doc.date >= fromDate && doc.date <= toDate;
    const inBranch = branch === "all" || doc.branch === branch;
    const inType = docType === "all" || doc.type === docType;
    return inDate && inBranch && inType;
  });

  function exportMonthlyCsv() {
    exportCsv(
      "grand-house-monthly-financial.csv",
      ["งวด", "ยอดขาย", "ต้นทุนขาย", "กำไรขั้นต้น", "ค่าใช้จ่าย", "กำไรสุทธิ"],
      monthRows.map((row) => [row.label, row.revenue, row.cogs, row.grossProfit, row.opex, row.netProfit]),
    );
  }

  function exportTaxCsv() {
    exportCsv(
      "grand-house-tax-documents.csv",
      ["เลขเอกสาร", "ประเภท", "วันที่", "สาขา", "คู่ค้า", "หมวด", "ก่อน VAT", "VAT", "รวม"],
      docs.map((doc) => [doc.documentNo, doc.type, doc.date, doc.branch, doc.party, doc.category, doc.amountBeforeVat, doc.vatAmount, doc.totalAmount]),
    );
  }

  return (
    <section className="stack">
      <div className="export-actions">
        <button className="primary action" onClick={exportMonthlyCsv}>
          <Download size={18} /> Export งบ CSV/Excel
        </button>
        <button className="primary action" onClick={exportTaxCsv}>
          <Download size={18} /> Export เอกสารภาษี CSV
        </button>
        <button className="primary action" onClick={() => exportFinancialPdf(state)}>
          <Download size={18} /> Export PDF/HTML
        </button>
      </div>
      <Panel title="ตัวกรองเอกสารส่งบัญชี" icon={Download}>
        <div className="clean-form export-filter-form">
          <Input name="fromDate" label="จากวันที่" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <Input name="toDate" label="ถึงวันที่" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          <Select
            name="branch"
            label="สาขา"
            value={branch}
            onChange={(event) => setBranch(event.target.value as Branch | "all")}
            options={[["all", "ทุกสาขา"], ...branches.map((item) => [item, item] as [string, string])]}
          />
          <Select
            name="docType"
            label="ประเภทเอกสาร"
            value={docType}
            onChange={(event) => setDocType(event.target.value)}
            options={[
              ["all", "ทุกประเภท"],
              ["ใบเสร็จ", "ใบเสร็จ"],
              ["ใบกำกับภาษี", "ใบกำกับภาษี"],
              ["ใบซื้อ", "ใบซื้อ"],
              ["ใบค่าใช้จ่าย", "ใบค่าใช้จ่าย"],
              ["ใบลดหนี้", "ใบลดหนี้"],
            ]}
          />
        </div>
      </Panel>
      <Panel title="งบการเงินรายเดือน" icon={Calculator}>
        <SimpleTable
          headers={["งวด", "ยอดขาย", "ต้นทุนขาย", "กำไรขั้นต้น", "ค่าใช้จ่าย", "กำไรสุทธิ"]}
          rows={monthRows.map((row) => [row.label, money(row.revenue), money(row.cogs), money(row.grossProfit), money(row.opex), money(row.netProfit)])}
        />
      </Panel>
      <Panel title="งบการเงินรายปี" icon={Calculator}>
        <SimpleTable
          headers={["ปี", "ยอดขาย", "ต้นทุนขาย", "กำไรขั้นต้น", "ค่าใช้จ่าย", "กำไรสุทธิ"]}
          rows={yearRows.map((row) => [row.label, money(row.revenue), money(row.cogs), money(row.grossProfit), money(row.opex), money(row.netProfit)])}
        />
      </Panel>
      <Panel title="เอกสารบัญชีและภาษี" icon={Download}>
        <SimpleTable
          headers={["เลขเอกสาร", "ประเภท", "วันที่", "สาขา", "คู่ค้า", "ก่อน VAT", "VAT", "รวม"]}
          rows={docs.map((doc) => [doc.documentNo, doc.type, doc.date, doc.branch, doc.party, money(doc.amountBeforeVat), money(doc.vatAmount), money(doc.totalAmount)])}
          empty="ยังไม่มีเอกสารบัญชี"
        />
      </Panel>
    </section>
  );
}

function SettingsPage({ state, commit }: { state: AppState; commit: (next: AppState, message: string) => void }) {
  function submitTax(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = updateTaxSettings(state, {
      vatEnabled: form.get("vatEnabled") === "on",
      vatRate: Number(form.get("vatRate")) || 0,
      priceIncludesVat: form.get("priceIncludesVat") === "รวม VAT",
    });
    commit(next, "บันทึกตั้งค่าภาษีแล้ว");
  }

  return (
    <section className="stack">
      <Panel title="ตั้งค่า VAT และเอกสาร" icon={Settings}>
        <form className="clean-form settings-form" onSubmit={submitTax}>
          <label className="checkline">
            <input name="vatEnabled" type="checkbox" defaultChecked={state.taxSettings.vatEnabled} />
            <span>เปิดใช้ VAT</span>
          </label>
          <Input name="vatRate" label="อัตรา VAT (%)" type="number" step="0.01" defaultValue={String(state.taxSettings.vatRate)} />
          <Select
            name="priceIncludesVat"
            label="ราคาขาย"
            defaultValue={state.taxSettings.priceIncludesVat ? "รวม VAT" : "ยังไม่รวม VAT"}
            options={[
              ["รวม VAT", "รวม VAT"],
              ["ยังไม่รวม VAT", "ยังไม่รวม VAT"],
            ]}
          />
          <button className="primary action" type="submit">
            <Save size={18} /> บันทึกตั้งค่า
          </button>
        </form>
      </Panel>
      <Panel title="สถานะระบบความปลอดภัย" icon={ShieldAlert}>
        <SimpleTable
          headers={["หัวข้อ", "สถานะ prototype", "แนวทางระบบจริง"]}
          rows={[
            ["การเข้าสู่ระบบ", "PIN ในเครื่อง", "Supabase Auth + บังคับรหัสผ่าน/2FA สำหรับเจ้าของ"],
            ["สิทธิ์ข้อมูล", "ซ่อนเมนูตามบทบาท", "RLS แยกเจ้าของ/พนักงาน/สาขา"],
            ["ประวัติแก้ไข", "audit log ใน localStorage", "audit log ฝั่ง server แก้ย้อนหลังไม่ได้"],
            ["สำรองข้อมูล", "ยังไม่มี backup จริง", "ตั้ง scheduled backup และ export รายวัน"],
          ]}
        />
      </Panel>
    </section>
  );
}

function Reconcile({ state }: { state: AppState }) {
  const stock = stockRevenue(state);
  const cash = cashIn(state);
  const diff = cash - stock;
  return (
    <section className="stack">
      <div className="metric-grid">
        <Metric label="ยอดเงินจริง" value={money(cash)} />
        <Metric label="ยอดจากสต็อก" value={money(stock)} />
        <Metric label="ส่วนต่าง" value={money(diff)} intent={Math.abs(diff) <= 20 ? "good" : "danger"} />
      </div>
      <Panel title="รายละเอียดการตรวจยอด" icon={Calculator}>
        <p className="plain-text">
          ถ้าส่วนต่างเกิน 20 บาท ให้ตรวจการนับของเหลือ, แถม, ของเสีย, ราคาพิเศษ และยอด QR/เงินสดของวันนั้นก่อนเชื่อ dashboard
        </p>
      </Panel>
    </section>
  );
}

function AuditPage({ state }: { state: AppState }) {
  return (
    <section className="stack">
      <Panel title="ประวัติการแก้ไขข้อมูลสำคัญ" icon={History}>
        <SimpleTable
          headers={["รหัส", "วันที่", "สาขา", "การทำงาน", "รายการ", "รายละเอียด"]}
          rows={state.auditLogs.slice(-80).reverse().map((log) => [log.id, log.date, log.branch || "-", log.action, `${log.targetType} ${log.targetId}`, log.detail])}
          empty="ยังไม่มีประวัติระบบ"
        />
      </Panel>
      <Panel title="ข้อจำกัดด้านความปลอดภัยของ prototype" icon={ShieldAlert}>
        <p className="plain-text">
          PIN และ audit log ชุดนี้ช่วยจำลอง workflow เท่านั้น ถ้าจะใช้เก็บข้อมูลร้านจริงต้องย้ายไป backend พร้อม Auth, RLS, backup และ log ฝั่ง server
        </p>
      </Panel>
    </section>
  );
}

function LotsTable({ state, lots }: { state: AppState; lots: typeof state.lots }) {
  return (
    <SimpleTable
      headers={["สินค้า", "LOT", "สาขา", "คงเหลือ", "ต้นทุน", "หมดอายุ", "สถานะ"]}
      rows={lots.map((lot) => {
        const product = productById(state.products, lot.productId);
        const status = lotStatus(lot);
        return [product?.name || "-", lot.id, lot.branch, `${number(lot.remaining, 2)} ${product?.unit || ""}`, money(lot.unitCost), lot.expiryDate, <Badge key={lot.id} status={status} />];
      })}
    />
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof BarChart3; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <Icon size={20} />
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function ChartPanel({ title, icon: Icon, children }: { title: string; icon: typeof BarChart3; children: React.ReactNode }) {
  return (
    <section className="panel chart-panel">
      <div className="panel-title">
        <Icon size={20} />
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, intent }: { label: string; value: string; intent?: "good" | "danger" }) {
  return (
    <article className={`metric ${intent || ""}`}>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function Quick({ label, icon: Icon }: { label: string; icon: typeof PackagePlus }) {
  return (
    <div className="quick">
      <Icon size={24} />
      <span>{label}</span>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  const { label, name, ...rest } = props;
  return (
    <label>
      <span>{label}</span>
      <input name={name} {...rest} />
    </label>
  );
}

function Select({ label, name, options, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string; options: [string, string][] }) {
  return (
    <label>
      <span>{label}</span>
      <select name={name} {...rest}>
        {options.map(([value, text]) => (
          <option value={value} key={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function Badge({ status }: { status: string }) {
  const kind = status === "หมดอายุ" || status === "ตัดเสีย" || status === "ยกเลิก" ? "danger" : status === "ใกล้หมดอายุ" ? "warning" : status === "ปกติ" ? "ok" : "muted";
  return <span className={`badge ${kind}`}>{status}</span>;
}

function SimpleTable({ headers, rows, empty = "ไม่มีข้อมูล" }: { headers: string[]; rows?: React.ReactNode[][]; empty?: string }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows && rows.length > 0 ? (
            rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={headers.length} className="empty">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
