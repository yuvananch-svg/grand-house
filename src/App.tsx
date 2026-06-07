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
  PanelLeftClose,
  PanelLeftOpen,
  Percent,
  Plus,
  RefreshCcw,
  ReceiptText,
  Save,
  Search,
  Settings,
  ShieldAlert,
  Store,
  Trash2,
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
  deleteProduct,
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

type Page =
  | "dashboard"
  | "pos"
  | "products"
  | "dailySales"
  | "salesHistory"
  | "inventory"

  | "expiry"
  | "recipes"
  | "count"
  | "cash"
  | "closeShift"
  | "financial"
  | "reconcile"
  | "settings"
  | "audit";

const pageItems: { id: Page; label: string; icon: typeof BarChart3; roles?: Role[] }[] = [
  { id: "dashboard", label: "ภาพรวม", icon: BarChart3, roles: ["owner", "backoffice"] },
  { id: "pos", label: "ขายหน้าร้าน", icon: CreditCard, roles: ["owner", "staff"] },
  { id: "products", label: "สินค้า", icon: PackagePlus, roles: ["owner"] },
  { id: "dailySales", label: "ยอดขายวันนี้", icon: BarChart3, roles: ["owner", "staff", "backoffice"] },
  { id: "salesHistory", label: "บิลขาย", icon: ReceiptText, roles: ["owner", "backoffice"] },
  { id: "inventory", label: "คลัง", icon: Boxes, roles: ["owner", "staff", "backoffice"] },
  { id: "expiry", label: "แจ้งเตือนหมดอายุ", icon: ShieldAlert, roles: ["owner", "staff"] },
  { id: "recipes", label: "สูตร / ต้นทุนเมนู", icon: ChefHat, roles: ["owner", "staff", "backoffice"] },
  { id: "count", label: "นับสต็อก", icon: ClipboardCheck, roles: ["owner", "staff", "backoffice"] },
  { id: "cash", label: "ค่าใช้จ่าย", icon: WalletCards, roles: ["owner", "backoffice"] },
  { id: "closeShift", label: "ปิดกะ", icon: FileCheck2, roles: ["owner", "staff"] },
  { id: "financial", label: "งบและภาษี", icon: Download, roles: ["owner"] },
  { id: "reconcile", label: "ตรวจยอดปิดวัน", icon: Calculator, roles: ["owner"] },
  { id: "settings", label: "ตั้งค่า", icon: Settings, roles: ["owner"] },
  { id: "audit", label: "ประวัติระบบ", icon: History, roles: ["owner"] },
];

const paymentChannels: PaymentChannel[] = ["QR1", "QR2", "ไทยช่วยไทย", "เงินสด", "online(grab)", "อื่นๆ"];
const productCategories = ["ข้าวกล่อง", "อาหารว่าง", "น้ำ", "ขนม", "อื่นๆ"];
const expenseCategories = ["ค่าแรง", "ค่าสาธารณูปโภค", "ค่าวัตถุดิบ", "ค่าดำเนินงาน", "ค่าบรรจุภัณฑ์", "อื่นๆ"];
const expensePaymentChannels: PaymentChannel[] = ["QR1", "QR2", "เงินสด", "อื่นๆ"];

function useButtonInteraction() {
  useEffect(() => {
    const updatePointer = (event: PointerEvent) => {
      const button = (event.target as Element | null)?.closest("button") as HTMLButtonElement | null;
      if (!button || button.disabled) return;
      const rect = button.getBoundingClientRect();
      button.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      button.style.setProperty("--my", `${event.clientY - rect.top}px`);
      button.style.setProperty("--tilt-x", `${((event.clientY - rect.top) / rect.height - 0.5) * -2}deg`);
      button.style.setProperty("--tilt-y", `${((event.clientX - rect.left) / rect.width - 0.5) * 2}deg`);
    };

    const pressButton = (event: PointerEvent) => {
      const button = (event.target as Element | null)?.closest("button") as HTMLButtonElement | null;
      if (!button || button.disabled) return;
      button.classList.remove("button-rebound");
      button.classList.add("button-pressed", "button-ripple");
      window.setTimeout(() => button.classList.remove("button-ripple"), 520);
    };

    const releaseButton = (event: PointerEvent) => {
      const button = (event.target as Element | null)?.closest("button") as HTMLButtonElement | null;
      if (!button) return;
      button.classList.remove("button-pressed");
      button.classList.add("button-rebound");
      window.setTimeout(() => button.classList.remove("button-rebound"), 420);
    };

    const clearTilt = (event: PointerEvent) => {
      const button = (event.target as Element | null)?.closest("button") as HTMLButtonElement | null;
      if (!button) return;
      button.style.setProperty("--tilt-x", "0deg");
      button.style.setProperty("--tilt-y", "0deg");
    };

    document.addEventListener("pointermove", updatePointer);
    document.addEventListener("pointerdown", pressButton);
    document.addEventListener("pointerup", releaseButton);
    document.addEventListener("pointercancel", releaseButton);
    document.addEventListener("pointerleave", clearTilt, true);

    return () => {
      document.removeEventListener("pointermove", updatePointer);
      document.removeEventListener("pointerdown", pressButton);
      document.removeEventListener("pointerup", releaseButton);
      document.removeEventListener("pointercancel", releaseButton);
      document.removeEventListener("pointerleave", clearTilt, true);
    };
  }, []);
}

function shortDate(date?: string) {
  if (!date) return "-";
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return date;
  return `${match[3]}-${match[2]}-${match[1].slice(-2)}`;
}

export function App() {
  useButtonInteraction();
  const [state, setState] = useState<AppState>(() => localRepository.load());
  const [role, setRole] = useState<Role | null>(null);
  const [currentBranch, setCurrentBranch] = useState<Branch>("บ้านโจ้");
  const [page, setPage] = useState<Page>("dashboard");
  const [toast, setToast] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarTooltip, setSidebarTooltip] = useState<{ label: string; top: number } | null>(null);

  useEffect(() => localRepository.save(state), [state]);

  const visiblePages = useMemo(() => pageItems.filter((item) => role && (!item.roles || item.roles.includes(role))), [role]);

  useEffect(() => {
    if (role && !visiblePages.some((item) => item.id === page)) {
      setPage("dashboard");
    }
  }, [page, role, visiblePages]);

  if (!role) {
    return (
      <LoginScreen
        onLogin={(nextRole, nextBranch) => {
          setRole(nextRole);
          setCurrentBranch(nextBranch);
          setPage(nextRole === "staff" ? "pos" : nextRole === "backoffice" ? "inventory" : "dashboard");
        }}
      />
    );
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
    setToast("ล้างข้อมูลในเครื่องแล้ว");
  }

  function showSidebarTooltip(label: string, element: HTMLElement) {
    if (!sidebarCollapsed && !window.matchMedia("(max-width: 1250px)").matches) return;
    const rect = element.getBoundingClientRect();
    setSidebarTooltip({ label, top: rect.top + rect.height / 2 });
  }

  function hideSidebarTooltip() {
    setSidebarTooltip(null);
  }

  return (
    <div className={sidebarCollapsed ? "app-shell sidebar-collapsed" : "app-shell"}>
      <aside className="sidebar">
        <button className="sidebar-toggle" type="button" onClick={() => setSidebarCollapsed((collapsed) => !collapsed)} aria-label={sidebarCollapsed ? "เปิดแถบเมนู" : "ปิดแถบเมนู"}>
          {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
        <div className="brand">
          <GrandHouseMark />
          <div>
            <h1>Grand House</h1>
            <p>ระบบคลังและต้นทุน</p>
          </div>
        </div>
        <div className="role-badge">
          {role === "owner" ? <UserRound size={18} /> : role === "backoffice" ? <Boxes size={18} /> : <Store size={18} />}
          <span>{role === "owner" ? "เจ้าของ" : role === "backoffice" ? "ฝ่ายออฟฟิศ" : "พนักงานสาขา"} · {role === "staff" ? currentBranch : "ทุกสาขา"}</span>
        </div>
        <nav>
          {visiblePages.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={page === item.id ? "nav-active" : ""}
                onClick={() => setPage(item.id)}
                onMouseEnter={(event) => showSidebarTooltip(item.label, event.currentTarget)}
                onMouseLeave={hideSidebarTooltip}
                onFocus={(event) => showSidebarTooltip(item.label, event.currentTarget)}
                onBlur={hideSidebarTooltip}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <button
          className="reset-button"
          onClick={resetDemo}
          onMouseEnter={(event) => showSidebarTooltip("ล้างข้อมูลในเครื่อง", event.currentTarget)}
          onMouseLeave={hideSidebarTooltip}
          onFocus={(event) => showSidebarTooltip("ล้างข้อมูลในเครื่อง", event.currentTarget)}
          onBlur={hideSidebarTooltip}
        >
          <RefreshCcw size={18} /> <span>ล้างข้อมูลในเครื่อง</span>
        </button>
        <button
          className="reset-button"
          onClick={() => setRole(null)}
          onMouseEnter={(event) => showSidebarTooltip("ออกจากระบบ", event.currentTarget)}
          onMouseLeave={hideSidebarTooltip}
          onFocus={(event) => showSidebarTooltip("ออกจากระบบ", event.currentTarget)}
          onBlur={hideSidebarTooltip}
        >
          <LogOut size={18} /> <span>ออกจากระบบ</span>
        </button>
      </aside>
      {sidebarTooltip && <div className="sidebar-tooltip" style={{ top: sidebarTooltip.top }}>{sidebarTooltip.label}</div>}

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
        {page === "pos" && <PosPage state={state} commit={commit} fail={fail} lockedBranch={role === "staff" ? currentBranch : undefined} />}
        {page === "products" && <ProductsPage state={state} commit={commit} fail={fail} />}
        {page === "dailySales" && <DailySalesPage state={state} role={role} currentBranch={currentBranch} />}
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

function GrandHouseMark({ large = false }: { large?: boolean }) {
  return (
    <div className={large ? "brand-mark brand-mark-large" : "brand-mark"} aria-label="Grand House">
      <svg viewBox="0 0 160 96" role="img" aria-hidden="true">
        <path className="logo-line" d="M8 61 C24 61 28 47 19 41 C10 34 2 45 9 56 C17 69 37 65 48 52" />
        <path className="logo-line" d="M48 52 C56 35 72 23 86 18 C101 28 120 45 136 57" />
        <path className="logo-line" d="M58 48 L85 20 L134 54" />
        <path className="logo-line" d="M61 48 C64 64 62 72 71 72 L119 72 C127 72 126 60 128 48" />
        <path className="logo-line" d="M82 72 L82 47 C82 42 86 40 92 40 L100 40 C105 40 108 43 108 48 L108 72" />
        <path className="logo-line" d="M72 30 L72 12 C72 8 75 7 82 7 C88 7 90 9 90 14 L90 24" />
        <path className="logo-line" d="M103 52 C103 49 105 47 108 47 C111 47 113 49 113 52 C113 55 111 57 108 57 C105 57 103 55 103 52" />
        <path className="logo-line" d="M6 73 C37 73 51 73 68 73" />
        <path className="logo-line" d="M119 73 C132 73 145 73 154 73" />
      </svg>
    </div>
  );
}

const loginModes: { role: Role; label: string; icon: typeof Store }[] = [
  { role: "staff", label: "พนักงานสาขา", icon: Store },
  { role: "backoffice", label: "ฝ่ายออฟฟิศ", icon: Boxes },
  { role: "owner", label: "เจ้าของ", icon: UserRound },
];

function LoginScreen({ onLogin }: { onLogin: (role: Role, branch: Branch) => void }) {
  const [selectedRole, setSelectedRole] = useState<Role>("staff");
  const [selectedBranch, setSelectedBranch] = useState<Branch>("บ้านโจ้");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const expected = selectedRole === "owner" ? "1234" : selectedRole === "backoffice" ? "2222" : "1111";
    if (pin !== expected) {
      setError("PIN ไม่ถูกต้อง");
      return;
    }
    onLogin(selectedRole, selectedBranch);
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-logo">
          <GrandHouseMark large />
          <h1>Grand House</h1>
        </div>
        <form className="login-form" onSubmit={submit}>
          <div className="login-mode-grid">
            {loginModes.map((mode) => {
              const Icon = mode.icon;
              return (
                <button key={mode.role} type="button" className={selectedRole === mode.role ? "login-mode active" : "login-mode"} onClick={() => setSelectedRole(mode.role)}>
                  <Icon size={20} />
                  <strong>{mode.label}</strong>
                </button>
              );
            })}
          </div>
          {selectedRole === "staff" && (
            <div className="branch-pills">
              {branches.map((branch) => (
                <button key={branch} type="button" className={selectedBranch === branch ? "branch-pill active" : "branch-pill"} onClick={() => setSelectedBranch(branch)}>
                  {branch}
                </button>
              ))}
            </div>
          )}
          <label>
            <span>รหัสเข้าใช้งาน</span>
            <input value={pin} inputMode="numeric" maxLength={6} onChange={(event) => setPin(event.target.value)} placeholder="กรอกรหัสของทางเข้านี้" />
          </label>
          {error && <p className="login-error">{error}</p>}
          <button className="primary action" type="submit">
            <LockKeyhole size={18} /> เข้าสู่ระบบ
          </button>

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

type PosSaleCategory = "อาหาร" | "ของนึ่ง" | "น้ำ" | "ผลไม้";
type PosLineType = "ขาย" | "แถมโปร";
type PosCartLine = { id: string; productId: string; quantity: number; unitPrice: number; discount: number; lineType: PosLineType; promoLabel?: string };

const posCategories: PosSaleCategory[] = ["อาหาร", "ของนึ่ง", "น้ำ", "ผลไม้"];
const promoModes = [
  { id: "morning", label: "โปร 10:00 ซื้อ 2 แถม 1", paidQty: 2, freeQty: 1 },
  { id: "afterNoon", label: "โปรหลัง 12:00 ซื้อ 1 แถม 1", paidQty: 1, freeQty: 1 },
];

function posCategory(product: Product): PosSaleCategory {
  if (product.category.includes("ผลไม้") || product.name.includes("ผลไม้")) return "ผลไม้";
  if (product.category.includes("น้ำ") || product.name.includes("น้ำ")) return "น้ำ";
  if (product.category.includes("ขนม") || product.name.includes("ขนมถ้วย")) return "ของนึ่ง";
  return "อาหาร";
}

function emptyPayments(): Record<PaymentChannel, number> {
  return { QR1: 0, QR2: 0, ไทยช่วยไทย: 0, เงินสด: 0, "online(grab)": 0, อื่นๆ: 0 };
}

function PosPage({
  state,
  commit,
  fail,
  lockedBranch,
}: {
  state: AppState;
  commit: (next: AppState, message: string) => void;
  fail: (message?: string) => void;
  lockedBranch?: Branch;
}) {
  const saleProducts = state.products.filter((product) => product.active && (product.type === "purchased_finished_good" || product.type === "produced_finished_good"));
  const [activeCategory, setActiveCategory] = useState<PosSaleCategory>("อาหาร");
  const [date, setDate] = useState(today);
  const [branch, setBranch] = useState<Branch>(lockedBranch || "บ้านโจ้");
  const [note, setNote] = useState("ขายหน้าร้าน");
  const [cart, setCart] = useState<PosCartLine[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<PaymentChannel>("QR1");
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [paymentAmounts, setPaymentAmounts] = useState<Record<PaymentChannel, number>>(emptyPayments());
  const [paymentTouched, setPaymentTouched] = useState(false);
  const [promoId, setPromoId] = useState(promoModes[0].id);
  const [paidProductId, setPaidProductId] = useState(saleProducts[0]?.id || "");
  const [freeProductId, setFreeProductId] = useState(saleProducts[0]?.id || "");
  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discount, 0), [cart]);
  const paidTotal = useMemo(() => paymentChannels.reduce((sum, channel) => sum + paymentAmounts[channel], 0), [paymentAmounts]);
  const paymentDiff = paidTotal - cartTotal;
  const visibleProducts = saleProducts.filter((product) => posCategory(product) === activeCategory);

  useEffect(() => {
    if (lockedBranch) setBranch(lockedBranch);
  }, [lockedBranch]);

  useEffect(() => {
    if (saleProducts.length > 0) {
      setPaidProductId((current) => current || saleProducts[0].id);
      setFreeProductId((current) => current || saleProducts[0].id);
    }
  }, [saleProducts]);

  useEffect(() => {
    if (!paymentTouched) {
      const next = emptyPayments();
      next[selectedPayment] = cartTotal;
      setReceivedAmount(cartTotal);
      setPaymentAmounts(next);
    }
  }, [cartTotal, paymentTouched, selectedPayment]);

  function availableFor(productId: string) {
    return activeLots(state, (lot) => lot.productId === productId && lot.branch === branch && lotStatus(lot) !== "หมดอายุ").reduce((sum, lot) => sum + lot.remaining, 0);
  }

  function addProduct(product: Product) {
    const available = availableFor(product.id);
    if (available <= 0) return fail(`${product.name} ไม่มีสต็อกที่ขายได้ในสาขา ${branch}`);
    setCart((items) => {
      const current = items.find((item) => item.productId === product.id && item.lineType === "ขาย" && !item.promoLabel);
      if (current) return items.map((item) => (item.id === current.id ? { ...item, quantity: item.quantity + 1 } : item));
      return [...items, { id: crypto.randomUUID(), productId: product.id, quantity: 1, unitPrice: product.salePrice || 0, discount: 0, lineType: "ขาย" }];
    });
  }

  function addPromo() {
    const mode = promoModes.find((item) => item.id === promoId) || promoModes[0];
    const paidProduct = productById(state.products, paidProductId);
    const freeProduct = productById(state.products, freeProductId);
    if (!paidProduct || !freeProduct) return fail("กรุณาเลือกสินค้าขายและสินค้าแถม");
    const requiredByProduct = new Map<string, number>();
    requiredByProduct.set(paidProduct.id, (requiredByProduct.get(paidProduct.id) || 0) + mode.paidQty);
    requiredByProduct.set(freeProduct.id, (requiredByProduct.get(freeProduct.id) || 0) + mode.freeQty);
    for (const [productId, qty] of requiredByProduct) {
      const product = productById(state.products, productId);
      if (availableFor(productId) < qty) return fail(`${product?.name || productId} มีสต็อกไม่พอสำหรับโปรนี้`);
    }
    setCart((items) => [
      ...items,
      { id: crypto.randomUUID(), productId: paidProduct.id, quantity: mode.paidQty, unitPrice: paidProduct.salePrice || 0, discount: 0, lineType: "ขาย", promoLabel: mode.label },
      { id: crypto.randomUUID(), productId: freeProduct.id, quantity: mode.freeQty, unitPrice: 0, discount: 0, lineType: "แถมโปร", promoLabel: mode.label },
    ]);
  }

  function updateCart(lineId: string, key: "quantity" | "unitPrice" | "discount", value: number) {
    setCart((items) => items.map((item) => (item.id === lineId ? { ...item, [key]: Math.max(0, value) } : item)).filter((item) => item.quantity > 0));
  }

  function removeCartLine(lineId: string) {
    setCart((items) => items.filter((item) => item.id !== lineId));
  }

  function choosePayment(channel: PaymentChannel, amount = receivedAmount || cartTotal) {
    setPaymentTouched(true);
    setSelectedPayment(channel);
    setReceivedAmount(amount);
    const next = emptyPayments();
    next[channel] = Math.max(0, amount);
    setPaymentAmounts(next);
  }

  function updateReceived(value: number) {
    const amount = Math.max(0, value);
    setPaymentTouched(true);
    setReceivedAmount(amount);
    const next = emptyPayments();
    next[selectedPayment] = amount;
    setPaymentAmounts(next);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = createPosSale(state, {
      date,
      branch,
      payments: paymentAmounts,
      items: cart,
      note,
    });
    if (result.error) return fail(result.error);
    setCart([]);
    setPaymentAmounts(emptyPayments());
    setReceivedAmount(0);
    setPaymentTouched(false);
    commit(result.state, "บันทึกบิล POS แล้ว");
  }

  return (
    <section className="pos-layout">
      <Panel title="สินค้าทั้งหมด" icon={Store}>
        <div className="filter-row">
          {posCategories.map((category) => (
            <button key={category} className={activeCategory === category ? "chip active" : "chip"} onClick={() => setActiveCategory(category)}>
              {category}
            </button>
          ))}
        </div>
        <div className="product-grid pos-product-grid">
          {visibleProducts.map((product) => {
            const available = availableFor(product.id);
            return (
              <button className="product-button" key={product.id} onClick={() => addProduct(product)}>
                <strong>{product.name}</strong>
                <span>{money(product.salePrice || 0)} · เหลือ {number(available, 2)} {product.unit}</span>
              </button>
            );
          })}
          {visibleProducts.length === 0 && <div className="empty-box">ยังไม่มีสินค้าในหมวด {activeCategory}</div>}
        </div>
      </Panel>
      <Panel title="รายการขายและโปรโมชัน" icon={CreditCard}>
        <form className="stack" onSubmit={submit}>
          <div className="clean-form pos-meta">
            <Input name="date" label="วันที่ขาย" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            <Select name="branch" label="สาขา" value={branch} disabled={Boolean(lockedBranch)} onChange={(event) => setBranch(event.target.value as Branch)} options={branches.map((item) => [item, item])} />
            <Input name="note" label="หมายเหตุ" value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
          <div className="promo-box">
            <div className="payment-header">
              <strong><Percent size={18} /> สินค้าโปร</strong>
              <span>เลือกสินค้าที่ขายได้ และตัวที่แถม</span>
            </div>
            <div className="clean-form promo-form">
              <Select name="promo" label="ช่วงโปร" value={promoId} onChange={(event) => setPromoId(event.target.value)} options={promoModes.map((item) => [item.id, item.label])} />
              <Select name="paidProduct" label="สินค้าที่ลูกค้าซื้อ" value={paidProductId} onChange={(event) => setPaidProductId(event.target.value)} options={saleProducts.map((product) => [product.id, product.name])} />
              <Select name="freeProduct" label="สินค้าที่แถม" value={freeProductId} onChange={(event) => setFreeProductId(event.target.value)} options={saleProducts.map((product) => [product.id, product.name])} />
              <button className="secondary action" type="button" onClick={addPromo}>
                <Plus size={18} /> เพิ่มโปรลงบิล
              </button>
            </div>
          </div>
          <SimpleTable
            headers={["ประเภท", "สินค้า", "โปร", "จำนวน", "ราคา", "ส่วนลด", "รวม", "ลบ"]}
            rows={cart.map((item) => {
              const product = productById(state.products, item.productId);
              return [
                <Badge key={`${item.id}-type`} status={item.lineType} />,
                product?.name || item.productId,
                item.promoLabel || "-",
                <input key="qty" className="mini-input" type="number" min="0" step="1" value={item.quantity} onChange={(event) => updateCart(item.id, "quantity", Number(event.target.value))} />,
                <input key="price" className="mini-input" type="number" min="0" step="1" value={item.unitPrice} onChange={(event) => updateCart(item.id, "unitPrice", Number(event.target.value))} />,
                <input key="discount" className="mini-input" type="number" min="0" step="1" value={item.discount} onChange={(event) => updateCart(item.id, "discount", Number(event.target.value))} />,
                money(item.quantity * item.unitPrice - item.discount),
                <button key="remove" className="small-danger" type="button" onClick={() => removeCartLine(item.id)}>ลบ</button>,
              ];
            })}
            empty="ยังไม่มีรายการในบิล"
          />
          <div className="pos-total">
            <span>ยอดที่ต้องรับ</span>
            <strong>{money(cartTotal)}</strong>
          </div>
          <div className="payment-box">
            <div className="payment-header">
              <strong>รับชำระ</strong>
              <span className={Math.abs(paymentDiff) <= 0.01 ? "good-text" : "danger-text"}>ส่วนต่าง {money(paymentDiff)}</span>
            </div>
            <div className="payment-entry">
              <Input name="receivedAmount" label="จำนวนเงินที่ลูกค้าชำระ" type="number" step="0.01" value={receivedAmount} onChange={(event) => updateReceived(Number(event.target.value))} />
              <div className="payment-channel-row">
                {paymentChannels.map((channel) => (
                  <button key={channel} className={selectedPayment === channel ? "chip active" : "chip"} type="button" onClick={() => choosePayment(channel)}>
                    {channel}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button className="primary action" type="submit">
            <Save size={18} /> บันทึกบิล
          </button>
        </form>
      </Panel>
    </section>
  );
}

function DailySalesPage({ state, role, currentBranch }: { state: AppState; role: Role; currentBranch: Branch }) {
  const [date, setDate] = useState(today);
  const [branchFilter, setBranchFilter] = useState<Branch | "all">(role === "staff" ? currentBranch : "all");
  const targetBranch = role === "staff" ? currentBranch : branchFilter;
  const branchMatches = (branch: Branch) => targetBranch === "all" || branch === targetBranch;
  const sales = state.sales.filter((sale) => sale.date === date && branchMatches(sale.branch) && sale.status !== "ยกเลิก");
  const saleIds = new Set(sales.map((sale) => sale.id));
  const items = state.saleItems.filter((item) => saleIds.has(item.saleId));
  const soldItems = items.filter((item) => item.lineType ? item.lineType === "ขาย" : item.revenue > 0);
  const freeItems = items.filter((item) => item.lineType ? item.lineType !== "ขาย" : item.revenue <= 0);
  const paymentRows = paymentChannels.map((channel) => ({
    channel,
    amount: state.payments.filter((payment) => payment.date === date && branchMatches(payment.branch) && payment.channel === channel).reduce((sum, payment) => sum + payment.amount, 0),
  }));
  const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
  const totalCost = sales.reduce((sum, sale) => sum + sale.costOfGoods, 0);
  const freeCost = freeItems.reduce((sum, item) => sum + item.costOfGoods, 0);
  const grossProfit = totalSales - totalCost;
  const soldRows = summarizeSaleItems(soldItems, state);
  const freeRows = summarizeSaleItems(freeItems, state, true);
  const wasteQty = state.sessions.filter((session) => session.date === date && branchMatches(session.branch)).reduce((sum, session) => sum + session.wasteQty, 0);
  const expiring = expiryAlerts(state).filter((item) => branchMatches(item.lot.branch));

  return (
    <section className="stack">
      <div className="daily-hero">
        <div>
          <p className="section-kicker">Front Store Pulse</p>
          <h3>ยอดขายประจำวัน</h3>
          <p>สรุปยอดขาย สินค้าแถม และของที่ต้องจัดการของ{targetBranch === "all" ? "ทุกสาขา" : `สาขา${targetBranch}`}</p>
        </div>
        <div className="daily-filters">
          <Input name="dailyDate" label="วันที่" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          {role === "owner" ? (
            <Select
              name="dailyBranch"
              label="สาขา"
              value={branchFilter}
              onChange={(event) => setBranchFilter(event.target.value as Branch | "all")}
              options={[["all", "ทุกสาขา"], ...branches.map((branch) => [branch, branch] as [string, string])]}
            />
          ) : (
            <Select name="dailyBranch" label="สาขา" value={currentBranch} disabled options={branches.map((branch) => [branch, branch])} />
          )}
        </div>
      </div>
      <div className="metric-grid premium-metrics">
        <Metric label="ยอดขายวันนี้" value={money(totalSales)} intent={totalSales > 0 ? "good" : undefined} />
        <Metric label="จำนวนบิล" value={`${number(sales.length)} บิล`} />
        <Metric label="กำไรขั้นต้น" value={money(grossProfit)} intent={grossProfit < 0 ? "danger" : "good"} />
        <Metric label="ต้นทุนของแถม" value={money(freeCost)} intent={freeCost > 0 ? "danger" : undefined} />
        <Metric label="รายการแถม" value={`${number(freeItems.reduce((sum, item) => sum + item.quantity, 0), 2)} ชิ้น`} />
        <Metric label="เสีย/ทิ้งวันนี้" value={`${number(wasteQty, 2)} ชิ้น`} intent={wasteQty > 0 ? "danger" : undefined} />
      </div>
      <div className="daily-grid">
        <Panel title="ยอดรับเงินแยกช่องทาง" icon={CreditCard}>
          <SimpleTable headers={["ช่องทาง", "ยอดรับ"]} rows={paymentRows.map((row) => [row.channel, money(row.amount)])} />
        </Panel>
        <ChartPanel title="สินค้าขายดีวันนี้" icon={BarChart3}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={soldRows.slice(0, 6)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={130} />
              <Tooltip formatter={(value) => money(Number(value))} />
              <Bar dataKey="revenue" name="ยอดขาย" fill="#b5121b" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>
      <div className="two-col">
        <Panel title="สินค้าที่ขายได้วันนี้" icon={Store}>
          <SimpleTable
            headers={["สินค้า", "จำนวนขาย", "รายได้", "ต้นทุน", "กำไร"]}
            rows={soldRows.map((row) => [row.name, number(row.quantity, 2), money(row.revenue), money(row.cost), money(row.revenue - row.cost)])}
            empty="ยังไม่มีรายการขายวันนี้"
          />
        </Panel>
        <Panel title="สินค้าที่แถมวันนี้" icon={Percent}>
          <SimpleTable
            headers={["สินค้า", "จำนวนแถม", "โปร/ที่มา", "ต้นทุนของแถม"]}
            rows={freeRows.map((row) => [row.name, number(row.quantity, 2), row.promoLabel || "แถม", money(row.cost)])}
            empty="ยังไม่มีรายการแถมวันนี้"
          />
        </Panel>
      </div>
      <Panel title="แจ้งเตือนสต็อกของสาขา" icon={ShieldAlert}>
        <SimpleTable
          headers={["สินค้า", "LOT", "สาขา", "หมดอายุ", "เหลือ", "สถานะ"]}
          rows={expiring.slice(0, 8).map((item) => [
            item.product.name,
            item.lot.id,
            item.lot.branch,
            item.lot.expiryDate,
            `${number(item.lot.remaining, 2)} ${item.product.unit}`,
            <Badge key={item.lot.id} status={item.status} />,
          ])}
          empty="ยังไม่มีรายการใกล้หมดอายุในสาขานี้"
        />
      </Panel>
    </section>
  );
}

function summarizeSaleItems(items: AppState["saleItems"], state: AppState, includePromo = false) {
  const rows = new Map<string, { name: string; quantity: number; revenue: number; cost: number; promoLabel?: string }>();
  for (const item of items) {
    const product = productById(state.products, item.productId);
    const current = rows.get(item.productId) || { name: product?.name || item.productId, quantity: 0, revenue: 0, cost: 0, promoLabel: includePromo ? item.promoLabel : undefined };
    current.quantity += item.quantity;
    current.revenue += item.revenue;
    current.cost += item.costOfGoods;
    if (includePromo && item.promoLabel && !current.promoLabel?.includes(item.promoLabel)) {
      current.promoLabel = current.promoLabel ? `${current.promoLabel}, ${item.promoLabel}` : item.promoLabel;
    }
    rows.set(item.productId, current);
  }
  return [...rows.values()].sort((a, b) => (includePromo ? b.cost - a.cost : b.revenue - a.revenue));
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

const rawMaterialCategories = ["เนื้อสัตว์", "ผัก", "ของแห้ง", "เครื่องปรุง", "น้ำ", "บรรจุภัณฑ์", "อื่นๆ"];
const rawMaterialUnits = ["กก.", "ชิ้น", "ถุง", "กล่อง", "ขวด", "แพ็ค", "ลิตร", "อื่นๆ"];

function ProductsPage({ state, commit, fail }: { state: AppState; commit: (next: AppState, message: string) => void; fail: (message?: string) => void }) {
  const [productSearch, setProductSearch] = useState("");
  const [supplierTab, setSupplierTab] = useState<"The Grand's" | "Grand House">("The Grand's");
  const [productTypeTab, setProductTypeTab] = useState<"สินค้า" | "วัตถุดิบ">("สินค้า");

  const normalizedSearch = productSearch.trim().toLowerCase();
  const productNameOptions = useMemo(() => [...new Set(state.products.map((product) => product.name.trim()).filter(Boolean))].sort(), [state.products]);
  const matchesProductSearch = (product: Product) => !normalizedSearch || product.name.toLowerCase().includes(normalizedSearch);
  const grandProducts = state.products.filter((product) => product.supplier === "The Grand's" && matchesProductSearch(product));
  const houseMenuProducts = state.products.filter((product) => product.type === "produced_finished_good" && product.supplier === "Grand House" && matchesProductSearch(product));
  const houseRawMaterials = state.products.filter((product) => (product.type === "raw_material" || product.type === "packaging") && matchesProductSearch(product));

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = createProduct(state, {
      name: String(form.get("name")),
      type: form.get("type") as ProductType,
      category: String(form.get("category")),
      unit: String(form.get("unit")),
      salePrice: Number(form.get("salePrice") || 0),
      standardCost: Number(form.get("standardCost")),
      costStartDate: String(form.get("costStartDate")),
      supplier: String(form.get("supplier")),
    });
    if (result.error) return fail(result.error);
    event.currentTarget.reset();
    commit(result.state, "เพิ่มรายการสินค้าแล้ว");
  }

  function toggleProduct(productId: string, active: boolean) {
    commit(setProductActive(state, productId, active), active ? "เปิดใช้งานสินค้าแล้ว" : "ปิดใช้งานสินค้าแล้ว");
  }

  function removeProduct(product: Product) {
    if (!window.confirm(`ลบ ${product.name} ออกจากรายการสินค้า?`)) return;
    commit(deleteProduct(state, product.id), "ลบสินค้าแล้ว");
  }

  function productTableRows(products: Product[], showSalePrice = true) {
    return products.map((product) => [
      product.id,
      product.name,
      product.category,
      showSalePrice ? (product.salePrice ? money(product.salePrice) : "-") : product.unit,
      product.standardCost !== undefined ? money(product.standardCost) : "-",
      shortDate(product.costStartDate),
      <button key={`${product.id}-status`} className={product.active ? "status-toggle active" : "status-toggle inactive"} onClick={() => toggleProduct(product.id, !product.active)}>
        {product.active ? "ใช้งาน" : "ปิดใช้งาน"}
      </button>,
      <button key={`${product.id}-delete`} className="icon-button danger-soft" type="button" onClick={() => removeProduct(product)} aria-label={`ลบ ${product.name}`}>
        <Trash2 size={18} />
      </button>,
    ]);
  }

  return (
    <section className="stack">
      <Panel title="ค้นหารายการสินค้า" icon={Search}>
        <label className="product-search">
          <span>ค้นหาจากชื่อสินค้า/เมนู</span>
          <input list="product-name-options" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="พิมพ์หรือเลือกรายการ เช่น กะเพราไก่" />
        </label>
        <datalist id="product-name-options">
          {productNameOptions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <div className="filter-row" style={{ marginTop: 16 }}>
          <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 700, alignSelf: "center" }}>แหล่งสินค้า:</span>
          <button className={supplierTab === "The Grand's" ? "chip active" : "chip"} onClick={() => setSupplierTab("The Grand's")}>
            <Store size={14} style={{ marginRight: 4 }} /> The Grand's
          </button>
          <button className={supplierTab === "Grand House" ? "chip active" : "chip"} onClick={() => setSupplierTab("Grand House")}>
            <ChefHat size={14} style={{ marginRight: 4 }} /> Grand House
          </button>
        </div>
        {supplierTab === "Grand House" && (
          <div className="filter-row" style={{ marginTop: 8 }}>
            <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 700, alignSelf: "center" }}>ประเภท:</span>
            <button className={productTypeTab === "สินค้า" ? "chip active" : "chip"} onClick={() => setProductTypeTab("สินค้า")}>สินค้า / เมนู</button>
            <button className={productTypeTab === "วัตถุดิบ" ? "chip active" : "chip"} onClick={() => setProductTypeTab("วัตถุดิบ")}>วัตถุดิบ</button>
          </div>
        )}
      </Panel>

      {supplierTab === "The Grand's" && (
        <Panel title="สินค้าจาก The Grand's" icon={Store}>
          <form className="clean-form product-split-form" onSubmit={submitProduct}>
            <Input name="name" label="ชื่อสินค้า" placeholder="เช่น ข้าวกล่อง / เค้ก / ขนม" />
            <input type="hidden" name="type" value="purchased_finished_good" />
            <Select name="category" label="หมวด" defaultValue="ข้าวกล่อง" options={productCategories.map((category) => [category, category])} />
            <input type="hidden" name="unit" value="ชิ้น" />
            <Input name="salePrice" label="ราคาขาย" type="number" step="0.01" defaultValue="0" />
            <Input name="standardCost" label="ต้นทุนต่อหน่วย" type="number" step="0.01" defaultValue="0" />
            <Input name="costStartDate" label="วันที่เริ่มใช้ต้นทุน" type="date" defaultValue={today} />
            <input type="hidden" name="supplier" value="The Grand's" />
            <button className="primary action" type="submit">
              <Save size={18} /> เพิ่มสินค้า
            </button>
          </form>
          <SimpleTable
            headers={["รหัส", "ชื่อสินค้า", "หมวด", "ราคาขาย", "ต้นทุน", "เริ่มใช้", "สถานะ", "จัดการ"]}
            rows={productTableRows(grandProducts)}
            empty={normalizedSearch ? "ไม่พบสินค้าจาก The Grand's ตามคำค้นหา" : "ยังไม่มีสินค้าจาก The Grand's"}
          />
        </Panel>
      )}

      {supplierTab === "Grand House" && productTypeTab === "สินค้า" && (
        <Panel title="เมนูจาก Grand House" icon={ChefHat}>
          <form className="clean-form product-split-form" onSubmit={submitProduct}>
            <Input name="name" label="ชื่อเมนู" placeholder="เช่น เมนูข้าว / เมนูอาหารใหม่" />
            <input type="hidden" name="type" value="produced_finished_good" />
            <Select name="category" label="หมวด" defaultValue="ข้าวกล่อง" options={productCategories.map((category) => [category, category])} />
            <input type="hidden" name="unit" value="จาน" />
            <Input name="salePrice" label="ราคาขาย" type="number" step="0.01" defaultValue="0" />
            <Input name="standardCost" label="ต้นทุนต่อหน่วย" type="number" step="0.01" defaultValue="0" />
            <Input name="costStartDate" label="วันที่เริ่มใช้ต้นทุน" type="date" defaultValue={today} />
            <input type="hidden" name="supplier" value="Grand House" />
            <button className="primary action" type="submit">
              <Save size={18} /> เพิ่มเมนู
            </button>
          </form>
          <SimpleTable
            headers={["รหัส", "ชื่อเมนู", "หมวด", "ราคาขาย", "ต้นทุน", "เริ่มใช้", "สถานะ", "จัดการ"]}
            rows={productTableRows(houseMenuProducts)}
            empty={normalizedSearch ? "ไม่พบเมนูจาก Grand House ตามคำค้นหา" : "ยังไม่มีเมนูจาก Grand House"}
          />
        </Panel>
      )}

      {supplierTab === "Grand House" && productTypeTab === "วัตถุดิบ" && (
        <Panel title="วัตถุดิบและบรรจุภัณฑ์" icon={Boxes}>
          <form className="clean-form product-split-form" onSubmit={submitProduct}>
            <Input name="name" label="ชื่อวัตถุดิบ" placeholder="เช่น เนื้อหมู / แป้ง / ถุงร้อน" />
            <input type="hidden" name="type" value="raw_material" />
            <Select name="category" label="หมวด" defaultValue="ของแห้ง" options={rawMaterialCategories.map((c) => [c, c])} />
            <Select name="unit" label="หน่วย" defaultValue="กก." options={rawMaterialUnits.map((u) => [u, u])} />
            <input type="hidden" name="standardCost" value="0" />
            <Input name="costStartDate" label="วันที่เริ่มใช้ต้นทุน" type="date" defaultValue={today} />
            <input type="hidden" name="supplier" value="Grand House" />
            <button className="primary action" type="submit">
              <Save size={18} /> เพิ่มวัตถุดิบ
            </button>
          </form>
          <SimpleTable
            headers={["รหัส", "ชื่อวัตถุดิบ", "หมวด", "หน่วย", "ต้นทุน", "เริ่มใช้", "สถานะ", "จัดการ"]}
            rows={productTableRows(houseRawMaterials, false)}
            empty={normalizedSearch ? "ไม่พบวัตถุดิบตามคำค้นหา" : "ยังไม่มีวัตถุดิบ"}
          />
        </Panel>
      )}
    </section>
  );
}

function Inventory({ state, commit, fail }: { state: AppState; commit: (next: AppState, message: string) => void; fail: (message?: string) => void }) {
  const grandIssuedProducts = state.products.filter(
    (product) => product.supplier === "The Grand's" && product.type === "purchased_finished_good" && product.active
  );
  const houseProducedProducts = state.products.filter(
    (product) => product.supplier === "Grand House" && product.type === "produced_finished_good" && product.active
  );
  const houseRawMaterials = state.products.filter(
    (product) => product.supplier === "Grand House" && product.type === "raw_material" && product.active
  );
  const housePackaging = state.products.filter(
    (product) => product.supplier === "Grand House" && product.type === "packaging" && product.active
  );
  const grandActiveProducts = grandIssuedProducts;
  const houseActiveProducts = houseProducedProducts;

  const [grandProductId, setGrandProductId] = useState("");
  const [grandSearch, setGrandSearch] = useState("");
  const [grandBranch, setGrandBranch] = useState<Branch>("บ้านโจ้");
  const [grandQty, setGrandQty] = useState(1);
  const [grandDate, setGrandDate] = useState(today);
  const [grandExpiryDate, setGrandExpiryDate] = useState(today);

  const [houseProductId, setHouseProductId] = useState("");
  const [houseSearch, setHouseSearch] = useState("");
  const [houseBranch, setHouseBranch] = useState<Branch>("บ้านโจ้");
  const [houseQty, setHouseQty] = useState(1);
  const [houseDate, setHouseDate] = useState(today);
  const [houseExpiryDate, setHouseExpiryDate] = useState(today);

  const [matProductId, setMatProductId] = useState("");
  const [matSearch, setMatSearch] = useState("");
  const [matBranch, setMatBranch] = useState<Branch>("บ้านโจ้");
  const [matQty, setMatQty] = useState(1);
  const [matWeightKg, setMatWeightKg] = useState(0);
  const [matDate, setMatDate] = useState(today);
  const [matExpiryDate, setMatExpiryDate] = useState(today);

  const [selectedBranch, setSelectedBranch] = useState<Branch | "all">("all");
  const [inventoryTab, setInventoryTab] = useState<"products" | "materials">("products");
  const [materialCategory, setMaterialCategory] = useState<"all" | string>("all");
  const [supplierFilter, setSupplierFilter] = useState<"all" | "The Grand's" | "Grand House">("all");
  const materialCategories = ["เนื้อสัตว์", "ผัก", "ของแห้ง", "เครื่องปรุง", "น้ำ", "บรรจุภัณฑ์", "อื่นๆ"];

  const allMaterials = [...houseRawMaterials, ...housePackaging];
  const filteredMaterials = materialCategory === "all" ? allMaterials : allMaterials.filter((p) => p.category === materialCategory);
  const selectedMaterial = productById(state.products, matProductId);
  const selectedMaterialUsesWeight = selectedMaterial?.unit === "กก.";

  function inventoryProductRows(sourceProducts: Product[], showStock = false, showCategory = false, showCostDate = false, showLotDate = false) {
    return sourceProducts.map((product) => {
      const cells: React.ReactNode[] = [product.id, product.name];
      if (showStock) {
        const remaining = state.lots
          .filter((lot) => lot.productId === product.id && (selectedBranch === "all" || lot.branch === selectedBranch))
          .reduce((sum, lot) => sum + lot.remaining, 0);
        cells.push(number(remaining, 2));
      }
      if (showCategory) {
        cells.push(product.category);
      }
      if (showCostDate) {
        cells.push(shortDate(product.costStartDate));
      }
      if (showLotDate) {
        const latestLot = state.lots
          .filter((lot) => lot.productId === product.id && (selectedBranch === "all" || lot.branch === selectedBranch))
          .sort((a, b) => b.receivedDate.localeCompare(a.receivedDate))[0];
        cells.push(shortDate(latestLot?.receivedDate));
      }
      const activeLots = state.lots.filter((lot) =>
        lot.productId === product.id &&
        lot.remaining > 0 &&
        (selectedBranch === "all" || lot.branch === selectedBranch)
      );
      const nearestExpiry = activeLots.length > 0
        ? activeLots.reduce((nearest, lot) => lot.expiryDate < nearest ? lot.expiryDate : nearest, activeLots[0].expiryDate)
        : undefined;
      cells.push(shortDate(nearestExpiry));
      return cells;
    });
  }

  function materialInventoryRows(sourceProducts: Product[]) {
    return sourceProducts.map((product) => {
      const lots = state.lots
        .filter((lot) => lot.productId === product.id && (selectedBranch === "all" || lot.branch === selectedBranch))
        .sort((a, b) => b.receivedDate.localeCompare(a.receivedDate));
      const remaining = lots.reduce((sum, lot) => sum + lot.remaining, 0);
      const latestLot = lots[0];
      return [
        product.id,
        product.name,
        `${number(remaining, 2)} ${product.unit}`,
        product.category,
        shortDate(latestLot?.receivedDate || product.costStartDate),
        shortDate(latestLot?.expiryDate || product.costStartDate),
      ];
    });
  }

  function submitGrandIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!grandProductId) return fail("กรุณาเลือกสินค้า");
    const product = productById(state.products, grandProductId);
    const next = receiveLot(state, {
      productId: grandProductId,
      branch: grandBranch,
      quantity: grandQty,
      unitCost: product?.standardCost || 0,
      receivedDate: grandDate,
      expiryDate: grandExpiryDate,
      supplier: "The Grand's",
      note: "เบิกจาก The Grand's",
    });
    commit(next, "รับสินค้าเข้าแล้ว");
    setGrandProductId("");
    setGrandSearch("");
    setGrandQty(1);
    setGrandExpiryDate(today);
  }

  function submitHouseProduce(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!houseProductId) return fail("กรุณาเลือกสินค้า");
    const recipe = state.recipes.find((r) => r.outputProductId === houseProductId);
    if (!recipe) return fail("ไม่พบสูตรอาหารสำหรับสินค้านี้");
    const result = produceBatch(state, {
      recipeId: recipe.id,
      branch: houseBranch,
      producedQty: houseQty,
      productionDate: houseDate,
      expiryDate: houseExpiryDate,
    });
    if (result.error) return fail(result.error);
    commit(result.state, "ผลิตสินค้าแล้ว");
    setHouseProductId("");
    setHouseSearch("");
    setHouseQty(1);
    setHouseExpiryDate(today);
  }

  function submitMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!matProductId) return fail("กรุณาเลือกรายการ");
    const product = productById(state.products, matProductId);
    const quantity = product?.unit === "กก." ? matWeightKg : matQty;
    if (quantity <= 0) return fail(product?.unit === "กก." ? "กรุณากรอกน้ำหนักกิโลกรัม" : "กรุณากรอกจำนวน");
    const next = receiveLot(state, {
      productId: matProductId,
      branch: matBranch,
      quantity,
      unitCost: product?.standardCost || 0,
      receivedDate: matDate,
      expiryDate: matExpiryDate,
      supplier: "Grand House",
      note: `${product?.type === "packaging" ? "รับบรรจุภัณฑ์" : "รับวัตถุดิบ"} ${number(quantity, 2)} ${product?.unit || "หน่วย"}`,
    });
    commit(next, "รับเข้าคลังแล้ว");
    setMatProductId("");
    setMatSearch("");
    setMatQty(1);
    setMatWeightKg(0);
    setMatExpiryDate(today);
  }

  return (
    <section className="stack">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="filter-row">
            <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 700, alignSelf: "center" }}>ดูสาขา:</span>
            {(["all", ...branches] as const).map((item) => (
              <button key={item} className={selectedBranch === item ? "chip active" : "chip"} onClick={() => setSelectedBranch(item)}>
                {item === "all" ? "ทุกสาขา" : item}
              </button>
            ))}
          </div>
          <div className="filter-row">
            <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 700, alignSelf: "center" }}>ดูหมวด:</span>
            <button className={inventoryTab === "products" ? "chip active" : "chip"} onClick={() => setInventoryTab("products")}>สินค้า</button>
            <button className={inventoryTab === "materials" ? "chip active" : "chip"} onClick={() => setInventoryTab("materials")}>วัตถุดิบ</button>
          </div>
        </div>
        <div className="supplier-filter-group">
          <button
            className={supplierFilter === "The Grand's" ? "supplier-filter-btn active" : "supplier-filter-btn"}
            onClick={() => setSupplierFilter(supplierFilter === "The Grand's" ? "all" : "The Grand's")}
          >
            <Store size={16} />
            <span>The Grand's</span>
          </button>
          <button
            className={supplierFilter === "Grand House" ? "supplier-filter-btn active" : "supplier-filter-btn"}
            onClick={() => setSupplierFilter(supplierFilter === "Grand House" ? "all" : "Grand House")}
          >
            <ChefHat size={16} />
            <span>Grand House</span>
          </button>
        </div>
      </div>
      {inventoryTab === "materials" && (
        <div className="filter-row">
          <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 700, alignSelf: "center" }}>กรอง:</span>
          <button className={materialCategory === "all" ? "chip active" : "chip"} onClick={() => setMaterialCategory("all")}>ทั้งหมด</button>
          {materialCategories.map((cat) => (
            <button key={cat} className={materialCategory === cat ? "chip active" : "chip"} onClick={() => setMaterialCategory(cat)}>
              {cat}
            </button>
          ))}
        </div>
      )}
      <div className="inventory-product-scroll">
        <div className={inventoryTab === "materials" || supplierFilter !== "all" ? "inventory-product-grid materials-grid" : "inventory-product-grid"}>
          {inventoryTab === "products" && (
            <>
              {(supplierFilter === "all" || supplierFilter === "The Grand's") && <Panel title="เบิกสินค้า The Grand's" icon={Store}>
                <form className="clean-form mini-form" onSubmit={submitGrandIssue}>
                  <label>
                    <span>เลือกสินค้า</span>
                    <input
                      list="grand-active-list"
                      value={grandSearch}
                      onChange={(e) => {
                        setGrandSearch(e.target.value);
                        const idMatch = e.target.value.match(/\[(.*?)\]/)?.[1];
                        const match = idMatch
                          ? grandActiveProducts.find((p) => p.id === idMatch)
                          : grandActiveProducts.find((p) => p.name === e.target.value);
                        setGrandProductId(match?.id || "");
                      }}
                      placeholder="พิมพ์หรือเลือกรายการ"
                    />
                    <datalist id="grand-active-list">
                      {grandActiveProducts.map((p) => (
                        <option key={p.id} value={`${p.name} [${p.id}]`} />
                      ))}
                    </datalist>
                  </label>
                  <Select name="grandBranch" label="สาขา" value={grandBranch} onChange={(e) => setGrandBranch(e.target.value as Branch)} options={branches.map((b) => [b, b])} />
                  <Input name="grandQty" label="จำนวน" type="number" step="0.01" value={grandQty} onChange={(e) => setGrandQty(Number(e.target.value))} />
                  <Input name="grandDate" label="วันที่เบิก" type="date" value={grandDate} onChange={(e) => setGrandDate(e.target.value)} />
                  <Input name="grandExpiryDate" label="วันหมดอายุ" type="date" value={grandExpiryDate} onChange={(e) => setGrandExpiryDate(e.target.value)} />
                  <button className="primary action" type="submit"><Save size={18} /> บันทึกเบิก</button>
                </form>
                <SimpleTable
                  headers={["รหัส", "ชื่อ", "คงเหลือ", "วันที่เบิก", "หมดอายุ"]}
                  rows={inventoryProductRows(grandIssuedProducts, true, false, true)}
                  empty="ยังไม่มีสินค้าเบิกจาก The Grand's"
                />
              </Panel>}
              {(supplierFilter === "all" || supplierFilter === "Grand House") && <Panel title="ผลิตสินค้า Grand House" icon={Factory}>
                <form className="clean-form mini-form" onSubmit={submitHouseProduce}>
                  <label>
                    <span>เลือกสินค้า</span>
                    <input
                      list="house-active-list"
                      value={houseSearch}
                      onChange={(e) => {
                        setHouseSearch(e.target.value);
                        const idMatch = e.target.value.match(/\[(.*?)\]/)?.[1];
                        const match = idMatch
                          ? houseActiveProducts.find((p) => p.id === idMatch)
                          : houseActiveProducts.find((p) => p.name === e.target.value);
                        setHouseProductId(match?.id || "");
                      }}
                      placeholder="พิมพ์หรือเลือกรายการ"
                    />
                    <datalist id="house-active-list">
                      {houseActiveProducts.map((p) => (
                        <option key={p.id} value={`${p.name} [${p.id}]`} />
                      ))}
                    </datalist>
                  </label>
                  <Select name="houseBranch" label="สาขา" value={houseBranch} onChange={(e) => setHouseBranch(e.target.value as Branch)} options={branches.map((b) => [b, b])} />
                  <Input name="houseQty" label="จำนวน" type="number" step="0.01" value={houseQty} onChange={(e) => setHouseQty(Number(e.target.value))} />
                  <Input name="houseDate" label="วันที่ผลิต" type="date" value={houseDate} onChange={(e) => setHouseDate(e.target.value)} />
                  <Input name="houseExpiryDate" label="วันหมดอายุ" type="date" value={houseExpiryDate} onChange={(e) => setHouseExpiryDate(e.target.value)} />
                  <button className="primary action" type="submit"><Save size={18} /> บันทึกผลิต</button>
                </form>
                <SimpleTable
                  headers={["รหัส", "ชื่อ", "คงเหลือ", "วันที่ผลิต", "หมดอายุ"]}
                  rows={inventoryProductRows(houseProducedProducts, true, false, false, true)}
                  empty="ยังไม่มีสินค้าผลิตเองของ Grand House"
                />
              </Panel>}
            </>
          )}
          {inventoryTab === "materials" && (
            <>
              <Panel title="รับเข้าวัตถุดิบและบรรจุภัณฑ์" icon={Boxes}>
                <form className="clean-form mini-form material-receive-form" onSubmit={submitMaterial}>
                  <label>
                    <span>เลือกรายการ</span>
                    <input
                      list="mat-active-list"
                      value={matSearch}
                      onChange={(e) => {
                        setMatSearch(e.target.value);
                        const idMatch = e.target.value.match(/\[(.*?)\]/)?.[1];
                        const match = idMatch
                          ? allMaterials.find((p) => p.id === idMatch)
                          : allMaterials.find((p) => p.name === e.target.value);
                        setMatProductId(match?.id || "");
                        if (match) {
                          setMatQty(match.unit === "กก." ? 0 : 1);
                          setMatWeightKg(match.unit === "กก." ? 1 : 0);
                        }
                      }}
                      placeholder="พิมพ์หรือเลือกรายการ"
                    />
                    <datalist id="mat-active-list">
                      {allMaterials.map((p) => (
                        <option key={p.id} value={`${p.name} [${p.id}]`} />
                      ))}
                    </datalist>
                  </label>
                  <Select name="matBranch" label="สาขา" value={matBranch} onChange={(e) => setMatBranch(e.target.value as Branch)} options={branches.map((b) => [b, b])} />
                  <Input
                    name="matQty"
                    label="จำนวน"
                    type="number"
                    step="1"
                    min="0"
                    value={matQty}
                    disabled={selectedMaterialUsesWeight}
                    onChange={(e) => setMatQty(Number(e.target.value))}
                  />
                  <Input
                    name="matWeightKg"
                    label="น้ำหนัก (กก.)"
                    type="number"
                    step="0.01"
                    min="0"
                    value={matWeightKg}
                    disabled={!!selectedMaterial && !selectedMaterialUsesWeight}
                    onChange={(e) => setMatWeightKg(Number(e.target.value))}
                  />
                  <Input name="matDate" label="วันที่รับ" type="date" value={matDate} onChange={(e) => setMatDate(e.target.value)} />
                  <Input name="matExpiryDate" label="วันหมดอายุ" type="date" value={matExpiryDate} onChange={(e) => setMatExpiryDate(e.target.value)} />
                  <button className="primary action" type="submit"><Save size={18} /> บันทึกรับ</button>
                </form>
              </Panel>
              <Panel title={`คลังวัตถุดิบ ${materialCategory === "all" ? "ทั้งหมด" : materialCategory}`} icon={Boxes}>
                <SimpleTable
                  headers={["รหัส", "ชื่อ", "คงเหลือ", "หมวด", "วันที่รับ", "หมดอายุ"]}
                  rows={materialInventoryRows(filteredMaterials)}
                  empty={`ยังไม่มีรายการในหมวด ${materialCategory === "all" ? "นี้" : materialCategory}`}
                />
              </Panel>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function GrandIssuePage({ state }: { state: AppState }) {
  const grandLots = state.lots.filter((lot) => {
    const product = productById(state.products, lot.productId);
    return product?.supplier === "The Grand's" || lot.supplier === "The Grand's";
  });
  const grandProducts = state.products.filter((product) => product.supplier === "The Grand's");

  return (
    <section className="stack">
      <Panel title="รายการสินค้าจากแกรนด์" icon={Store}>
        <SimpleTable
          headers={["รหัส", "สินค้า", "หมวด", "ราคาขาย", "สถานะ"]}
          rows={grandProducts.map((product) => [
            product.id,
            product.name,
            product.category,
            product.salePrice ? money(product.salePrice) : "-",
            <Badge key={product.id} status={product.active ? "ปกติ" : "ปิดใช้งาน"} />,
          ])}
          empty="ยังไม่มีสินค้าจากแกรนด์"
        />
      </Panel>
      <Panel title="สรุปเบิก ขาย แถม เสีย เหลือ แยก LOT" icon={ClipboardCheck}>
        <SimpleTable
          headers={["สินค้า", "LOT", "สาขา", "เบิกมา", "ขาย", "แถม", "เสีย/ทิ้ง", "เหลือ", "ต้นทุนขาย", "รายได้", "กำไร"]}
          rows={grandLots.map((lot) => {
            const product = productById(state.products, lot.productId);
            const saleRows = state.saleItems.filter((item) => item.lotId === lot.id);
            const soldQty = saleRows.filter((item) => item.revenue > 0).reduce((sum, item) => sum + item.quantity, 0);
            const freeQty = saleRows.filter((item) => item.revenue <= 0).reduce((sum, item) => sum + item.quantity, 0);
            const wasteQty =
              state.sessions.filter((session) => session.lotId === lot.id).reduce((sum, session) => sum + session.wasteQty, 0) +
              Math.abs(state.adjustments.filter((adjustment) => adjustment.lotId === lot.id && adjustment.quantityChange < 0).reduce((sum, adjustment) => sum + adjustment.quantityChange, 0));
            const revenue = saleRows.reduce((sum, item) => sum + item.revenue, 0);
            const cost = saleRows.reduce((sum, item) => sum + item.costOfGoods, 0);
            return [
              product?.name || lot.productId,
              lot.id,
              lot.branch,
              `${number(lot.quantityIn, 2)} ${product?.unit || ""}`,
              number(soldQty, 2),
              number(freeQty, 2),
              number(wasteQty, 2),
              `${number(lot.remaining, 2)} ${product?.unit || ""}`,
              money(cost),
              money(revenue),
              money(revenue - cost),
            ];
          })}
          empty="ยังไม่มี LOT ที่เบิกจากแกรนด์"
        />
      </Panel>
      <Panel title="แนวทางปิดยอดรายวัน" icon={FileCheck2}>
        <p className="plain-text">
          สูตรตรวจยอดคือ เบิกมา = ขาย + แถม + เสีย/ทิ้ง + เหลือ/คืนแกรนด์ ถ้าตัวเลขไม่เท่ากันต้องตรวจบิล โปร และการนับของเหลือก่อนปิดวัน
        </p>
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
          <Input name="recipeName" label="ชื่อสูตร" placeholder="เช่น สูตรเมนูใหม่" />
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
  const [expenseCategory, setExpenseCategory] = useState(expenseCategories[0]);
  const [expenseProductId, setExpenseProductId] = useState("");
  const rawMaterialOptions = state.products.filter((product) => product.active && product.type === "raw_material");
  const packagingOptions = state.products.filter((product) => product.active && product.type === "packaging");
  const stockExpenseProducts = expenseCategory === "ค่าวัตถุดิบ" ? rawMaterialOptions : expenseCategory === "ค่าบรรจุภัณฑ์" ? packagingOptions : [];
  const requiresStockProduct = expenseCategory === "ค่าวัตถุดิบ" || expenseCategory === "ค่าบรรจุภัณฑ์";
  const purchaseQtyLabel = expenseCategory === "ค่าสาธารณูปโภค" ? "หน่วย" : expenseCategory === "ค่าวัตถุดิบ" ? "น้ำหนัก (กก.)" : "จำนวนที่ซื้อ";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const purchaseQty = Number(form.get("purchaseQty"));
    const amount = Number(form.get("amount"));
    const category = String(form.get("category"));
    const expenseDate = String(form.get("date"));
    const expiryDate = String(form.get("expiryDate"));
    const expenseProduct = productById(state.products, String(form.get("expenseProductId")));
    if (requiresStockProduct && !expenseProduct) {
      window.alert(category === "ค่าวัตถุดิบ" ? "กรุณาเลือกรายการวัตถุดิบ" : "กรุณาเลือกรายการบรรจุภัณฑ์");
      return;
    }
    if (requiresStockProduct && purchaseQty <= 0) {
      window.alert(category === "ค่าวัตถุดิบ" ? "กรุณากรอกน้ำหนักกิโลกรัม" : "กรุณากรอกจำนวนที่ซื้อ");
      return;
    }
    if (requiresStockProduct && !expiryDate) {
      window.alert("กรุณาเลือกวันหมดอายุ");
      return;
    }
    const cashState = addCashEntry(state, {
      date: expenseDate,
      branch: "บ้านโจ้",
      type: "จ่ายเงิน",
      category,
      purchaseQty,
      paymentChannel: form.get("paymentChannel") as PaymentChannel,
      expenseProductId: expenseProduct?.id,
      amount,
      note: String(form.get("note")),
    });
    const next = requiresStockProduct && expenseProduct
      ? receiveLot(cashState, {
          productId: expenseProduct.id,
          branch: "บ้านโจ้",
          quantity: purchaseQty,
          unitCost: purchaseQty > 0 ? amount / purchaseQty : 0,
          receivedDate: expenseDate,
          expiryDate,
          supplier: "Grand House",
          note: `${category} ${expenseProduct.name}`,
          recordCash: false,
        })
      : cashState;
    event.currentTarget.reset();
    setExpenseCategory(expenseCategories[0]);
    setExpenseProductId("");
    commit(next, requiresStockProduct ? "บันทึกค่าใช้จ่ายและรับเข้าคลังแล้ว" : "บันทึกค่าใช้จ่ายแล้ว");
  }
  return (
    <section className="stack">
      <Panel title="บันทึกค่าใช้จ่าย" icon={WalletCards}>
        <form className="clean-form expense-form" onSubmit={submit}>
          <Input name="date" label="วันที่" type="date" defaultValue={today} />
          <Select
            name="category"
            label="ประเภท"
            value={expenseCategory}
            onChange={(event) => {
              setExpenseCategory(event.target.value);
              setExpenseProductId("");
            }}
            options={expenseCategories.map((category) => [category, category])}
          />
          {requiresStockProduct && (
            <Select
              name="expenseProductId"
              label={expenseCategory === "ค่าวัตถุดิบ" ? "รายการวัตถุดิบ" : "รายการบรรจุภัณฑ์"}
              value={expenseProductId}
              onChange={(event) => setExpenseProductId(event.target.value)}
              options={[["", "เลือกรายการ"], ...stockExpenseProducts.map((product) => [product.id, product.name] as [string, string])]}
            />
          )}
          <Input name="purchaseQty" label={purchaseQtyLabel} type="number" step="0.01" defaultValue="1" />
          {requiresStockProduct && <Input name="expiryDate" label="วันหมดอายุ" type="date" defaultValue={today} />}
          <Select name="paymentChannel" label="การจ่ายเงิน" options={expensePaymentChannels.map((channel) => [channel, channel])} />
          <Input name="amount" label="จำนวนเงิน" type="number" step="0.01" defaultValue="0" />
          <Input name="note" label="อื่นๆ" placeholder="พิมพ์โน้ตเพิ่มเติม" />
          <button className="primary action" type="submit">
            <Save size={18} /> บันทึกค่าใช้จ่าย
          </button>
        </form>
      </Panel>
      <Panel title="รายการค่าใช้จ่ายล่าสุด" icon={Landmark}>
        <SimpleTable
          headers={["วันที่", "ประเภท", "รายการ", "จำนวนที่ซื้อ", "การจ่ายเงิน", "จำนวนเงิน", "อื่นๆ"]}
          rows={state.cashEntries
            .filter((entry) => entry.type === "จ่ายเงิน")
            .slice(-12)
            .reverse()
            .map((entry) => [entry.date, entry.category, productById(state.products, entry.expenseProductId || "")?.name || "-", entry.purchaseQty ?? "-", entry.paymentChannel || "-", money(entry.amount), entry.note || "-"])}
        />
      </Panel>
    </section>
  );
}

function CloseShiftPage({ state, commit }: { state: AppState; commit: (next: AppState, message: string) => void }) {
  const channels: PaymentChannel[] = paymentChannels;
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
