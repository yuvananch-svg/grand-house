import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Calculator,
  ChefHat,
  ClipboardCheck,
  CreditCard,
  Factory,
  FileText,
  History,
  Languages,
  Landmark,
  LogOut,
  MoreHorizontal,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  ShieldAlert,
  Trash2,
  UserCog,
  WalletCards
} from "lucide-react";
import type { ErrorInfo, FormEvent, ReactNode } from "react";
import { Component, useEffect, useState } from "react";
import { callApi, getApiMode } from "./api/client";
import { type IconComponent } from "./components/ui";
import { createSeedState } from "./data/seed";
import { cacheSession, clearCachedSession } from "./db/dexie";
import { flushOutbox, getOutboxCount } from "./db/syncEngine";
import { branchName } from "./domain/lookups";
import { t } from "./i18n";
import { DashboardPage } from "./pages/owner/DashboardPage";
import { RevenuePage } from "./pages/owner/RevenuePage";
import { AuditPage } from "./pages/owner/AuditPage";
import { FinancialPage } from "./pages/owner/FinancialPage";
import { AdminPage } from "./pages/owner/AdminPage";
import { ItemsPage } from "./pages/owner/ItemsPage";
import { InventoryPage } from "./pages/office/InventoryPage";
import { GoodsReceivePage } from "./pages/office/GoodsReceivePage";
import { RawPurchasePage } from "./pages/office/RawPurchasePage";
import { ProductionPage } from "./pages/office/ProductionPage";
import { StockAdjustPage } from "./pages/office/StockAdjustPage";
import { ReconcilePage } from "./pages/office/ReconcilePage";
import { ExpensesPage } from "./pages/office/ExpensesPage";
import { POSPage } from "./pages/staff/POSPage";
import { SaleHistoryPage } from "./pages/staff/SaleHistoryPage";
import { WastagePage } from "./pages/staff/WastagePage";
import { DayClosePage } from "./pages/staff/DayClosePage";
import { useAuthStore } from "./stores/authStore";
import { getInitialAppData, loadAppData } from "./stores/dataStore";
import type {
  Language,
  LocalState,
  Session
} from "./types";
import { todayBangkok } from "./utils/ids";

type Page =
  | "pos"
  | "saleHistory"
  | "wastage"
  | "dayClose"
  | "goodsReceive"
  | "rawPurchase"
  | "inventory"
  | "production"
  | "stockAdjust"
  | "reconcile"
  | "expenses"
  | "dashboard"
  | "revenue"
  | "financial"
  | "items"
  | "audit"
  | "admin";

const OUTBOX_SYNC_INTERVAL_MS = 15_000;
const SNAPSHOT_REFRESH_INTERVAL_MS = 180_000;
const SIDEBAR_COLLAPSED_KEY = "grands-house-sidebar-collapsed";

type ToastState = { message: string; kind: "success" | "error" };

const nav: { page: Page; icon: IconComponent; roles: Session["role"][] }[] = [
  { page: "pos", icon: CreditCard, roles: ["staff", "owner"] },
  { page: "saleHistory", icon: ReceiptText, roles: ["staff", "owner"] },
  { page: "wastage", icon: Trash2, roles: ["staff", "owner"] },
  { page: "dayClose", icon: ClipboardCheck, roles: ["staff", "owner"] },
  { page: "goodsReceive", icon: PackagePlus, roles: ["office", "owner"] },
  { page: "rawPurchase", icon: Landmark, roles: ["office", "owner"] },
  { page: "inventory", icon: Boxes, roles: ["office", "owner"] },
  { page: "production", icon: Factory, roles: ["office", "owner"] },
  { page: "stockAdjust", icon: ShieldAlert, roles: ["office", "owner"] },
  { page: "reconcile", icon: Calculator, roles: ["office", "owner"] },
  { page: "expenses", icon: WalletCards, roles: ["office", "owner"] },
  { page: "items", icon: ChefHat, roles: ["owner"] },
  { page: "dashboard", icon: BarChart3, roles: ["owner"] },
  { page: "revenue", icon: PieChartIcon, roles: ["owner"] },
  { page: "financial", icon: FileText, roles: ["owner"] },
  { page: "audit", icon: History, roles: ["owner"] },
  { page: "admin", icon: UserCog, roles: ["owner"] }
];

const mobilePrimaryPages: Record<Session["role"], Page[]> = {
  staff: ["pos", "saleHistory", "wastage", "dayClose"],
  office: ["inventory", "goodsReceive", "rawPurchase", "reconcile"],
  owner: ["dashboard", "pos", "items", "revenue"]
};

function PieChartIcon(props: { size?: string | number }) {
  return <BarChart3 size={props.size || 20} />;
}

class ErrorBoundary extends Component<{ children: ReactNode; onError: (error: Error, info: ErrorInfo) => void; resetKey: string }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError(error, info);
  }

  componentDidUpdate(previousProps: { resetKey: string }) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="panel">
          <div className="panel-title"><AlertTriangle size={20} /><h3>เกิดข้อผิดพลาด</h3></div>
          <p className="error-text">หน้านี้หยุดทำงานชั่วคราว ระบบบันทึก error แล้ว กรุณาเปลี่ยนหน้าแล้วกลับมาใหม่</p>
        </section>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const { session, setSession, language, setLanguage } = useAuthStore();
  const [state, setState] = useState<LocalState>(() => createSeedState());
  const [page, setPage] = useState<Page>("pos");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [outboxCount, setOutboxCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) !== "false");
  const apiMode = getApiMode();

  const refresh = async (nextSession: Session | null = session) => {
    setState(await loadAppData(nextSession));
    setOutboxCount(await getOutboxCount());
  };

  useEffect(() => {
    void getInitialAppData().then(setState);
  }, []);

  useEffect(() => {
    const syncOutbox = async () => {
      if (!session) {
        setOutboxCount(await getOutboxCount());
        return;
      }
      if (!navigator.onLine) {
        setOutboxCount(await getOutboxCount());
        return;
      }
      const result = await flushOutbox(session);
      setOutboxCount(await getOutboxCount());
      if (result.sent > 0 || result.failed > 0) {
        setState(await loadAppData(session, { mode: "light" }));
      }
    };
    const refreshSnapshot = async () => {
      if (session && navigator.onLine) await refresh(session);
    };
    const onOnline = () => {
      setOnline(true);
      void syncOutbox();
      void refreshSnapshot();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const outboxInterval = window.setInterval(() => void syncOutbox(), OUTBOX_SYNC_INTERVAL_MS);
    const snapshotInterval = window.setInterval(() => void refreshSnapshot(), SNAPSHOT_REFRESH_INTERVAL_MS);
    void refresh(session);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(outboxInterval);
      window.clearInterval(snapshotInterval);
    };
  }, [session]);

  useEffect(() => {
    const handler = async () => {
      setSession(null);
      await clearCachedSession();
      setToast({ message: "Session หมดอายุ กรุณา login ใหม่", kind: "error" });
    };
    window.addEventListener("grandshouse:auth-expired", handler);
    return () => window.removeEventListener("grandshouse:auth-expired", handler);
  }, [setSession]);

  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      if (session) void callApi("log.clientError", { message: event.message, stack: event.error?.stack, url: location.href }, session);
    };
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      if (session) void callApi("log.clientError", { message: String(event.reason?.message || event.reason), stack: event.reason?.stack, url: location.href }, session);
    };
    window.addEventListener("error", handler);
    window.addEventListener("unhandledrejection", rejectionHandler);
    return () => {
      window.removeEventListener("error", handler);
      window.removeEventListener("unhandledrejection", rejectionHandler);
    };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const firstPage = nav.find((item) => item.roles.includes(session.role))?.page || "pos";
    if (!nav.some((item) => item.page === page && item.roles.includes(session.role))) setPage(firstPage);
  }, [session, page]);

  const notify = (message: string, kind: ToastState["kind"] = "success") => {
    setToast({ message, kind });
    if (kind === "success") window.setTimeout(() => setToast(null), 2600);
  };

  const reportBoundaryError = (error: Error, info: ErrorInfo) => {
    if (session) void callApi("log.clientError", { message: error.message, stack: `${error.stack || ""}\n${info.componentStack}`, url: location.href }, session);
  };

  if (!session) {
    return <LoginScreen language={language} setLanguage={setLanguage} onLogin={async (next) => {
      setSession(next);
      await cacheSession(next);
      setPage(next.role === "staff" ? "pos" : next.role === "office" ? "inventory" : "dashboard");
      await refresh(next);
    }} />;
  }

  const visibleNav = nav.filter((item) => item.roles.includes(session.role));
  const title = visibleNav.find((item) => item.page === page)?.page || page;
  const visibleNavItems = mobilePrimaryPages[session.role]
    .map((primaryPage) => visibleNav.find((item) => item.page === primaryPage))
    .filter((item): item is (typeof nav)[number] => Boolean(item));
  const moreNavItems = visibleNav.filter((item) => !mobilePrimaryPages[session.role].includes(item.page));
  const hasActiveMorePage = moreNavItems.some((item) => item.page === page);
  const selectPage = (nextPage: Page) => {
    setPage(nextPage);
    setMobileMenuOpen(false);
  };
  const logout = async () => {
    setSession(null);
    await clearCachedSession();
  };
  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };
  const sidebarToggleLabel = sidebarCollapsed ? "ขยายเมนูด้านซ้าย" : "ย่อเมนูด้านซ้าย";
  const SidebarToggleIcon = sidebarCollapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <div className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">GH</div>
          <div>
            <h1>Grand's House</h1>
            <p>{apiMode === "gas" ? "Google Sheets sync" : "Local-first operations"}</p>
          </div>
          <button className="sidebar-toggle" type="button" onClick={toggleSidebar} title={sidebarToggleLabel} aria-label={sidebarToggleLabel}>
            <SidebarToggleIcon size={20} />
          </button>
        </div>
        <div className="session-card">
          <strong>{session.display_name}</strong>
          <span>{session.role} · {branchName(state, session.branch_id)}</span>
        </div>
        <nav className="nav-list">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const label = pageTitle(language, item.page);
            return (
              <button key={item.page} className={page === item.page ? "active" : ""} onClick={() => selectPage(item.page)} title={label} aria-label={label}>
                <Icon size={20} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-actions">
          <button className="ghost" onClick={() => setLanguage(language === "th" ? "my" : "th")} title="Language" aria-label="Language">
            <Languages size={18} /> {language === "th" ? "ไทย" : "မြန်မာ"}
          </button>
          <button
            className="ghost"
            onClick={logout}
            title={t(language, "logout")}
            aria-label={t(language, "logout")}
          >
            <LogOut size={18} /> {t(language, "logout")}
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <span className="eyebrow">{todayBangkok()} · {title}</span>
            <h2>{pageTitle(language, page)}</h2>
          </div>
          <div className="status-row">
            <span className={online ? "net online" : "net offline"}>{online ? t(language, "online") : t(language, "offline")}</span>
            <span className="net pending">{outboxCount} {t(language, "pending")}</span>
          </div>
        </header>

        {toast && <div className={`toast ${toast.kind}`}><span>{toast.message}</span><button type="button" onClick={() => setToast(null)}>ปิด</button></div>}

        <ErrorBoundary resetKey={page} onError={reportBoundaryError}>
          {page === "pos" && <POSPage state={state} session={session} language={language} refresh={refresh} notify={notify} />}
          {page === "saleHistory" && <SaleHistoryPage state={state} session={session} refresh={refresh} notify={notify} outboxCount={outboxCount} />}
          {page === "wastage" && <WastagePage state={state} session={session} refresh={refresh} notify={notify} />}
          {page === "dayClose" && <DayClosePage state={state} session={session} refresh={refresh} notify={notify} outboxCount={outboxCount} />}
          {page === "goodsReceive" && <GoodsReceivePage state={state} session={session} refresh={refresh} notify={notify} />}
          {page === "rawPurchase" && <RawPurchasePage state={state} session={session} refresh={refresh} notify={notify} />}
          {page === "inventory" && <InventoryPage state={state} />}
          {page === "production" && <ProductionPage state={state} session={session} refresh={refresh} notify={notify} />}
          {page === "stockAdjust" && <StockAdjustPage state={state} session={session} refresh={refresh} notify={notify} />}
          {page === "reconcile" && <ReconcilePage state={state} session={session} refresh={refresh} notify={notify} />}
          {page === "expenses" && <ExpensesPage state={state} session={session} refresh={refresh} notify={notify} />}
          {page === "dashboard" && <DashboardPage state={state} />}
          {page === "revenue" && <RevenuePage state={state} />}
          {page === "financial" && <FinancialPage state={state} notify={notify} />}
          {page === "items" && <ItemsPage state={state} session={session} refresh={refresh} notify={notify} />}
          {page === "audit" && <AuditPage state={state} />}
          {page === "admin" && <AdminPage state={state} session={session} refresh={refresh} notify={notify} />}
        </ErrorBoundary>
      </main>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.page} className={page === item.page ? "active" : ""} onClick={() => selectPage(item.page)} type="button">
              <Icon size={20} />
              <span>{pageTitle(language, item.page)}</span>
            </button>
          );
        })}
        <button className={hasActiveMorePage || mobileMenuOpen ? "active" : ""} onClick={() => setMobileMenuOpen((open) => !open)} type="button" aria-expanded={mobileMenuOpen}>
          <MoreHorizontal size={20} />
          <span>เพิ่มเติม</span>
        </button>
      </nav>
      {mobileMenuOpen && (
        <div className="mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-menu-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-menu-head">
              <strong>เพิ่มเติม</strong>
              <button className="ghost" type="button" onClick={() => setMobileMenuOpen(false)}>ปิด</button>
            </div>
            {moreNavItems.length > 0 && (
              <div className="mobile-menu-grid">
                {moreNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.page} className={page === item.page ? "active" : ""} onClick={() => selectPage(item.page)} type="button">
                      <Icon size={20} />
                      <span>{pageTitle(language, item.page)}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mobile-menu-actions">
              <span>{session.display_name} · {branchName(state, session.branch_id)}</span>
              <button className="secondary" type="button" onClick={() => setLanguage(language === "th" ? "my" : "th")}><Languages size={18} /> {language === "th" ? "ไทย" : "မြန်မာ"}</button>
              <button className="danger" type="button" onClick={logout}><LogOut size={18} /> {t(language, "logout")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LoginScreen({ language, setLanguage, onLogin }: { language: Language; setLanguage: (language: Language) => void; onLogin: (session: Session) => void }) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const apiMode = getApiMode();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const response = await callApi<Session>("login", { user_id: userId, password });
    if (!response.ok) {
      setError(response.message);
      return;
    }
    onLogin(response.data);
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand">
          <div className="brand-mark big">GH</div>
          <div>
            <h1>Grand's House</h1>
            <p>{apiMode === "gas" ? "Google Sheets connected" : "Fresh local build"}</p>
          </div>
        </div>
        <form onSubmit={submit} className="form-grid">
          <label>
            <span>{t(language, "userId")}</span>
            <input value={userId} onChange={(event) => setUserId(event.target.value)} />
          </label>
          <label>
            <span>{t(language, "password")}</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button className="primary" type="submit">{t(language, "login")}</button>
          <button className="ghost" type="button" onClick={() => setLanguage(language === "th" ? "my" : "th")}>
            <Languages size={18} /> {language === "th" ? "ไทย" : "မြန်မာ"}
          </button>
        </form>
        {apiMode === "local" && <p className="hint">ตัวอย่าง local: owner/owner1234, office01/office1234, kaset01/staff1234</p>}
      </section>
    </main>
  );
}

function pageTitle(language: Language, page: Page) {
  const labels: Record<Page, string> = {
    pos: t(language, "pos"),
    saleHistory: t(language, "saleHistory"),
    wastage: t(language, "wastage"),
    dayClose: t(language, "dayClose"),
    goodsReceive: t(language, "goodsReceive"),
    rawPurchase: t(language, "rawPurchase"),
    inventory: t(language, "inventory"),
    production: t(language, "production"),
    stockAdjust: t(language, "stockAdjust"),
    reconcile: t(language, "reconcile"),
    expenses: t(language, "expenses"),
    dashboard: t(language, "dashboard"),
    revenue: t(language, "revenue"),
    financial: t(language, "financial"),
    items: t(language, "items"),
    audit: t(language, "audit"),
    admin: t(language, "admin")
  };
  return labels[page];
}
