"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Settings, User, Palette, Database, Cloud,
  Sun, Moon, Check, Trash2, Users, ShoppingCart, Receipt,
  RotateCcw, Trash, Search, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme, type ThemeAccent, type FontSize } from "@/contexts/theme-context";
import { useSettings, useUpdateSettings, useChangePassword } from "@/hooks/use-settings";
import {
  updateSettingsSchema,
  changePasswordSchema,
  type UpdateSettingsInput,
  type ChangePasswordInput,
} from "@/validations/settings.schema";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassTextarea } from "@/components/ui/glass-textarea";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassModal } from "@/components/ui/glass-modal";
import { PageHeader } from "@/components/layout/page-header";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "general" | "account" | "appearance" | "data" | "sync" | "trash";
type TrashType = "all" | "customers" | "orders" | "expenses";

interface NavItem {
  id:    Tab;
  label: string;
  icon:  React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { id: "general",    label: "General",          icon: Settings  },
  { id: "account",    label: "Account Settings", icon: User      },
  { id: "appearance", label: "Appearance",        icon: Palette   },
  { id: "data",       label: "Data",              icon: Database  },
  { id: "sync",       label: "Sync",              icon: Cloud     },
  { id: "trash",      label: "Trash",             icon: Trash2    },
];

// ─── Accent colours ───────────────────────────────────────────────────────────

const ACCENTS: { value: ThemeAccent; color: string; label: string }[] = [
  { value: "blue",   color: "#007AFF", label: "Blue"   },
  { value: "purple", color: "#AF52DE", label: "Purple" },
  { value: "rose",   color: "#FF375F", label: "Rose"   },
  { value: "green",  color: "#30D158", label: "Green"  },
  { value: "amber",  color: "#FF9F0A", label: "Amber"  },
];

// ─── Font-size options ────────────────────────────────────────────────────────

const FONT_SIZES: { value: FontSize; label: string; sample: string }[] = [
  { value: "small",   label: "Small",       sample: "Aa" },
  { value: "normal",  label: "Normal",      sample: "Aa" },
  { value: "large",   label: "Large",       sample: "Aa" },
  { value: "x-large", label: "Extra Large", sample: "Aa" },
];

// ─── Currency stored in localStorage ─────────────────────────────────────────

interface CurrencyPrefs {
  currencyCode:         string;
  currencySymbol:       string;
  exchangeCurrencyCode: string;
  exchangeCurrencySymbol: string;
}

const CURRENCY_DEFAULTS: CurrencyPrefs = {
  currencyCode:           "USD",
  currencySymbol:         "$",
  exchangeCurrencyCode:   "MMK",
  exchangeCurrencySymbol: "Ks",
};

function useCurrencyPrefs() {
  const [prefs, setPrefs] = useState<CurrencyPrefs>(CURRENCY_DEFAULTS);

  useEffect(() => {
    const stored = localStorage.getItem("currency-prefs");
    if (stored) setPrefs(JSON.parse(stored));
  }, []);

  function update(next: CurrencyPrefs) {
    setPrefs(next);
    localStorage.setItem("currency-prefs", JSON.stringify(next));
  }

  return { prefs, update };
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[26px] w-[46px] shrink-0 cursor-pointer rounded-full",
        "border-2 border-transparent transition-colors duration-200 focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        checked ? "bg-accent" : "bg-white/10",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full",
          "bg-white shadow-lg ring-0 transition duration-200",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="mb-5 mt-8 first:mt-0">
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-t3">{title}</h3>
      <div className="mt-2 h-px bg-divide" />
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-8 py-3.5 border-b border-divide last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-t1">{label}</p>
        {description && <p className="mt-0.5 text-xs text-t3">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ─── Section panels ───────────────────────────────────────────────────────────

function GeneralPanel() {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const { prefs, update } = useCurrencyPrefs();
  const [currency, setCurrency] = useState(prefs);

  useEffect(() => { setCurrency(prefs); }, [prefs]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateSettingsInput>({
    resolver: zodResolver(updateSettingsSchema),
    defaultValues: {
      shopName:         "",
      phone:            "",
      address:          "",
      logoUrl:          "",
      customerIdPrefix: "CUST",
      orderIdPrefix:    "ORD",
    },
  });

  useEffect(() => {
    if (settings)
      reset({
        shopName:         settings.shopName,
        phone:            settings.phone            ?? "",
        address:          settings.address          ?? "",
        logoUrl:          settings.logoUrl           ?? "",
        customerIdPrefix: settings.customerIdPrefix,
        orderIdPrefix:    settings.orderIdPrefix,
      });
  }, [settings, reset]);

  return (
    <div>
      <form onSubmit={handleSubmit((d) => updateSettings.mutate(d))}>
        <SectionDivider title="Shop Information" />
        <div className="space-y-4">
          <GlassInput label="Shop Name *" error={errors.shopName?.message} {...register("shopName")} />
          <GlassInput label="Phone"                                         {...register("phone")} />
          <GlassTextarea label="Address"                                    {...register("address")} />
          <GlassInput label="Logo URL" placeholder="https://…"  error={errors.logoUrl?.message} {...register("logoUrl")} />
          <div className="grid grid-cols-2 gap-4">
            <GlassInput label="Customer ID Prefix" placeholder="CUST" error={errors.customerIdPrefix?.message} {...register("customerIdPrefix")} />
            <GlassInput label="Order ID Prefix"    placeholder="ORD"  error={errors.orderIdPrefix?.message}    {...register("orderIdPrefix")} />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <GlassButton type="submit" loading={updateSettings.isPending}>Save Settings</GlassButton>
        </div>
      </form>

      {/* Currency – localStorage only */}
      <SectionDivider title="Currency Settings" />
      <div className="grid grid-cols-2 gap-4">
        <GlassInput
          label="Currency Code"
          value={currency.currencyCode}
          onChange={(e) => setCurrency({ ...currency, currencyCode: e.target.value })}
        />
        <GlassInput
          label="Currency Symbol"
          value={currency.currencySymbol}
          onChange={(e) => setCurrency({ ...currency, currencySymbol: e.target.value })}
        />
        <GlassInput
          label="Exchange Currency Code"
          value={currency.exchangeCurrencyCode}
          onChange={(e) => setCurrency({ ...currency, exchangeCurrencyCode: e.target.value })}
        />
        <GlassInput
          label="Exchange Currency Symbol"
          value={currency.exchangeCurrencySymbol}
          onChange={(e) => setCurrency({ ...currency, exchangeCurrencySymbol: e.target.value })}
        />
      </div>
      <div className="mt-6 flex justify-end">
        <GlassButton onClick={() => update(currency)}>Save Currency</GlassButton>
      </div>
    </div>
  );
}

function AccountPanel() {
  const changePassword = useChangePassword();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  return (
    <div>
      <SectionDivider title="Change Password" />
      <form
        onSubmit={handleSubmit((d) =>
          changePassword.mutate(d, { onSuccess: () => reset() })
        )}
        className="space-y-4"
      >
        <GlassInput label="Current Password" type="password" error={errors.currentPassword?.message} {...register("currentPassword")} />
        <GlassInput label="New Password"     type="password" error={errors.newPassword?.message}     {...register("newPassword")} />
        <GlassInput label="Confirm Password" type="password" error={errors.confirmPassword?.message} {...register("confirmPassword")} />
        <div className="flex justify-end">
          <GlassButton type="submit" loading={changePassword.isPending}>Change Password</GlassButton>
        </div>
      </form>
    </div>
  );
}

function AppearancePanel() {
  const { mode, accent, fontSize, animations, compact, setMode, setAccent, setFontSize, setAnimations, setCompact } = useTheme();

  return (
    <div>
      <SectionDivider title="Display" />
      <SettingRow label="Dark Mode" description="Switch between light and dark themes">
        <Toggle checked={mode === "dark"} onChange={(on) => setMode(on ? "dark" : "light")} />
      </SettingRow>
      <SettingRow label="Smooth Animations" description="Enable fluid transition effects">
        <Toggle checked={animations} onChange={setAnimations} />
      </SettingRow>
      <SettingRow label="Compact Mode" description="Reduce spacing for higher density">
        <Toggle checked={compact} onChange={setCompact} />
      </SettingRow>

      <SectionDivider title="Font Size" />
      <p className="mb-4 text-xs text-t3">Adjust the application text size</p>
      <div className="grid grid-cols-4 gap-2">
        {FONT_SIZES.map((fs) => (
          <button
            key={fs.value}
            type="button"
            onClick={() => setFontSize(fs.value)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-2xl border py-4 transition-all duration-150",
              fontSize === fs.value
                ? "border-accent bg-accent-bg text-t1"
                : "border-line bg-field text-t2 hover:border-line-strong hover:text-t1",
            )}
          >
            <span
              className={cn(
                "font-semibold leading-none",
                fs.value === "small"   && "text-sm",
                fs.value === "normal"  && "text-base",
                fs.value === "large"   && "text-lg",
                fs.value === "x-large" && "text-xl",
              )}
            >
              {fs.sample}
            </span>
            <span className="text-xs text-t3">{fs.label}</span>
          </button>
        ))}
      </div>

      <SectionDivider title="Accent Color" />
      <div className="flex items-center gap-3">
        {ACCENTS.map((a) => (
          <button
            key={a.value}
            type="button"
            onClick={() => setAccent(a.value)}
            title={a.label}
            aria-label={a.label}
            aria-pressed={accent === a.value}
            className="relative flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-150 hover:scale-110"
            style={{ backgroundColor: a.color }}
          >
            {accent === a.value && (
              <Check className="h-4 w-4 text-white drop-shadow" strokeWidth={3} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Trash types ──────────────────────────────────────────────────────────────

interface DeletedCustomer {
  id: string;
  customerId: string;
  name: string;
  phone: string | null;
  city: string | null;
  platform: string | null;
  deletedAt: string;
}

interface DeletedOrder {
  id: string;
  orderId: string;
  status: string;
  orderFrom: string | null;
  orderDate: string | null;
  deletedAt: string;
}

interface DeletedExpense {
  id: string;
  expenseId: string | null;
  category: string;
  amount: number;
  description: string;
  date: string;
  deletedAt: string;
}

interface TrashData {
  customers: DeletedCustomer[];
  orders: DeletedOrder[];
  expenses: DeletedExpense[];
}

// ─── Trash Panel ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending:    "bg-amber-500/15 text-amber-400",
  processing: "bg-blue-500/15 text-blue-400",
  arrived:    "bg-purple-500/15 text-purple-400",
  completed:  "bg-green-500/15 text-green-400",
};

const EXPENSE_CATEGORY_COLORS: Record<string, string> = {
  shipping:  "bg-blue-500/15 text-blue-400",
  supplies:  "bg-amber-500/15 text-amber-400",
  rent:      "bg-purple-500/15 text-purple-400",
  utilities: "bg-green-500/15 text-green-400",
  salary:    "bg-rose-500/15 text-rose-400",
  other:     "bg-white/10 text-t3",
};

function TrashBadge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-medium capitalize", colorClass)}>
      {label}
    </span>
  );
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function TrashPanel() {
  const [activeType, setActiveType] = useState<TrashType>("all");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<TrashData>({ customers: [], orders: [], expenses: [] });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; type: "customers" | "orders" | "expenses"; label: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, kind: "success" | "error") => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trash?type=${activeType}`);
      const json = await res.json();
      if (json.data) setData(json.data);
    } finally {
      setLoading(false);
    }
  }, [activeType]);

  useEffect(() => { fetchTrash(); }, [fetchTrash]);

  async function handleRestore(type: "customers" | "orders" | "expenses", id: string) {
    setActionLoading(`restore-${id}`);
    try {
      const res = await fetch(`/api/trash/${type}/${id}`, { method: "PATCH" });
      if (!res.ok) throw new Error();
      showToast("Record restored successfully", "success");
      fetchTrash();
    } catch {
      showToast("Failed to restore record", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePermanentDelete() {
    if (!confirmDelete) return;
    const { id, type } = confirmDelete;
    setActionLoading(`delete-${id}`);
    setConfirmDelete(null);
    try {
      const res = await fetch(`/api/trash/${type}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast("Record permanently deleted", "success");
      fetchTrash();
    } catch {
      showToast("Failed to delete record", "error");
    } finally {
      setActionLoading(null);
    }
  }

  const q = search.toLowerCase();

  const filteredCustomers = data.customers.filter((c) =>
    !q || c.name.toLowerCase().includes(q) || c.customerId.toLowerCase().includes(q) || (c.phone ?? "").includes(q)
  );
  const filteredOrders = data.orders.filter((o) =>
    !q || o.orderId.toLowerCase().includes(q) || (o.orderFrom ?? "").toLowerCase().includes(q)
  );
  const filteredExpenses = data.expenses.filter((e) =>
    !q || e.description.toLowerCase().includes(q) || (e.expenseId ?? "").toLowerCase().includes(q)
  );

  const showCustomers = activeType === "all" || activeType === "customers";
  const showOrders    = activeType === "all" || activeType === "orders";
  const showExpenses  = activeType === "all" || activeType === "expenses";

  const totalVisible =
    (showCustomers ? filteredCustomers.length : 0) +
    (showOrders    ? filteredOrders.length    : 0) +
    (showExpenses  ? filteredExpenses.length  : 0);

  const TYPE_FILTERS: { id: TrashType; label: string; icon: React.ElementType; count: number }[] = [
    { id: "all",       label: "All",       icon: Trash2,       count: data.customers.length + data.orders.length + data.expenses.length },
    { id: "customers", label: "Customers", icon: Users,        count: data.customers.length },
    { id: "orders",    label: "Orders",    icon: ShoppingCart, count: data.orders.length    },
    { id: "expenses",  label: "Expenses",  icon: Receipt,      count: data.expenses.length  },
  ];

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={cn(
          "mb-4 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium",
          toast.kind === "success" ? "bg-green-500/15 text-green-400" : "bg-ios-red/15 text-ios-red",
        )}>
          {toast.message}
        </div>
      )}

      <SectionDivider title="Deleted Records" />
      <p className="mb-4 text-xs text-t3">
        Records deleted from the system. Restore to recover them or permanently delete to remove forever.
      </p>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {TYPE_FILTERS.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveType(id)}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all",
              activeType === id
                ? "bg-accent-bg text-t1 border border-accent/30"
                : "bg-field text-t2 border border-line hover:border-line-strong hover:text-t1",
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
            <span className={cn(
              "ml-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
              activeType === id ? "bg-accent/20 text-accent" : "bg-white/8 text-t3",
            )}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-t3 pointer-events-none" />
        <input
          type="text"
          placeholder="Search deleted records…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={cn(
            "w-full rounded-2xl border border-line bg-field py-2.5 pl-9 pr-4 text-sm text-t1",
            "placeholder:text-t3 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30",
            "transition-all",
          )}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-t3 text-sm">Loading trash…</div>
      ) : totalVisible === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-field">
            <Trash2 className="h-5 w-5 text-t3" />
          </div>
          <p className="text-sm font-medium text-t1">Trash is empty</p>
          <p className="mt-1 text-xs text-t3">
            {search ? "No deleted records match your search." : "No deleted records found."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Customers */}
          {showCustomers && filteredCustomers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-3.5 w-3.5 text-t3" />
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-t3">
                  Customers ({filteredCustomers.length})
                </span>
              </div>
              <div className="rounded-2xl border border-line overflow-hidden">
                {filteredCustomers.map((c, i) => (
                  <div
                    key={c.id}
                    className={cn(
                      "flex items-center justify-between gap-4 px-4 py-3",
                      i !== filteredCustomers.length - 1 && "border-b border-divide",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-t1 truncate">{c.name}</span>
                        <span className="text-[11px] text-t3 font-mono">{c.customerId}</span>
                        {c.platform && <TrashBadge label={c.platform} colorClass="bg-purple-500/15 text-purple-400" />}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {c.phone && <span className="text-xs text-t3">{c.phone}</span>}
                        {c.city  && <span className="text-xs text-t3">{c.city}</span>}
                        <span className="text-xs text-t3">Deleted {formatDate(c.deletedAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRestore("customers", c.id)}
                        disabled={actionLoading === `restore-${c.id}`}
                        title="Restore"
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-field text-t2 transition-all hover:border-accent/50 hover:text-accent disabled:opacity-40"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete({ id: c.id, type: "customers", label: c.name })}
                        disabled={!!actionLoading}
                        title="Delete permanently"
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-field text-t2 transition-all hover:border-ios-red/50 hover:text-ios-red disabled:opacity-40"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Orders */}
          {showOrders && filteredOrders.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="h-3.5 w-3.5 text-t3" />
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-t3">
                  Orders ({filteredOrders.length})
                </span>
              </div>
              <div className="rounded-2xl border border-line overflow-hidden">
                {filteredOrders.map((o, i) => (
                  <div
                    key={o.id}
                    className={cn(
                      "flex items-center justify-between gap-4 px-4 py-3",
                      i !== filteredOrders.length - 1 && "border-b border-divide",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-t1 font-mono">{o.orderId}</span>
                        <TrashBadge label={o.status} colorClass={STATUS_COLORS[o.status] ?? "bg-white/10 text-t3"} />
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {o.orderFrom  && <span className="text-xs text-t3">{o.orderFrom}</span>}
                        {o.orderDate  && <span className="text-xs text-t3">Ordered {formatDate(o.orderDate)}</span>}
                        <span className="text-xs text-t3">Deleted {formatDate(o.deletedAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRestore("orders", o.id)}
                        disabled={actionLoading === `restore-${o.id}`}
                        title="Restore"
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-field text-t2 transition-all hover:border-accent/50 hover:text-accent disabled:opacity-40"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete({ id: o.id, type: "orders", label: o.orderId })}
                        disabled={!!actionLoading}
                        title="Delete permanently"
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-field text-t2 transition-all hover:border-ios-red/50 hover:text-ios-red disabled:opacity-40"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expenses */}
          {showExpenses && filteredExpenses.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Receipt className="h-3.5 w-3.5 text-t3" />
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-t3">
                  Expenses ({filteredExpenses.length})
                </span>
              </div>
              <div className="rounded-2xl border border-line overflow-hidden">
                {filteredExpenses.map((e, i) => (
                  <div
                    key={e.id}
                    className={cn(
                      "flex items-center justify-between gap-4 px-4 py-3",
                      i !== filteredExpenses.length - 1 && "border-b border-divide",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-t1 truncate">{e.description}</span>
                        {e.expenseId && <span className="text-[11px] text-t3 font-mono">{e.expenseId}</span>}
                        <TrashBadge label={e.category} colorClass={EXPENSE_CATEGORY_COLORS[e.category] ?? "bg-white/10 text-t3"} />
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs font-semibold text-t2">${e.amount.toLocaleString()}</span>
                        <span className="text-xs text-t3">{formatDate(e.date)}</span>
                        <span className="text-xs text-t3">Deleted {formatDate(e.deletedAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRestore("expenses", e.id)}
                        disabled={actionLoading === `restore-${e.id}`}
                        title="Restore"
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-field text-t2 transition-all hover:border-accent/50 hover:text-accent disabled:opacity-40"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete({ id: e.id, type: "expenses", label: e.description })}
                        disabled={!!actionLoading}
                        title="Delete permanently"
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-field text-t2 transition-all hover:border-ios-red/50 hover:text-ios-red disabled:opacity-40"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Confirm permanent delete modal */}
      <GlassModal
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Permanently Delete?"
        size="sm"
      >
        <div className="flex items-start gap-3 mb-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ios-red/15">
            <AlertTriangle className="h-5 w-5 text-ios-red" />
          </div>
          <div>
            <p className="text-sm text-t1">
              <span className="font-semibold">&ldquo;{confirmDelete?.label}&rdquo;</span> will be permanently removed and cannot be recovered.
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <GlassButton variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</GlassButton>
          <GlassButton variant="danger" size="sm" onClick={handlePermanentDelete}>Delete Forever</GlassButton>
        </div>
      </GlassModal>
    </div>
  );
}

function PlaceholderPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-field">
        <Database className="h-6 w-6 text-t3" />
      </div>
      <p className="text-sm font-medium text-t1">{title}</p>
      <p className="mt-1 text-xs text-t3">{description}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("general");

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your application preferences" />

      <div className="flex gap-5 items-start">
        {/* Sidebar nav */}
        <nav className="w-52 shrink-0 rounded-2xl border border-line bg-surface p-2 backdrop-blur-xl">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150",
                tab === id
                  ? "bg-accent-bg text-t1 font-medium"
                  : "text-t2 hover:bg-surface-hover hover:text-t1",
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", tab === id ? "text-accent" : "text-t3")} />
              {label}
            </button>
          ))}
        </nav>

        {/* Content panel */}
        <div className="flex-1 min-w-0 rounded-2xl border border-line bg-surface p-6 backdrop-blur-xl">
          <div className="mb-1">
            <h2 className="text-base font-semibold text-t1">
              {NAV_ITEMS.find((n) => n.id === tab)?.label}
            </h2>
            <p className="text-xs text-t3">
              {tab === "general"    && "Configure basic shop preferences"}
              {tab === "account"    && "Manage your account credentials"}
              {tab === "appearance" && "Customize the look and feel"}
              {tab === "data"       && "Import, export and manage your data"}
              {tab === "sync"       && "Sync settings across devices"}
              {tab === "trash"      && "View and manage deleted records"}
            </p>
          </div>

          <div className="mt-2">
            {tab === "general"    && <GeneralPanel />}
            {tab === "account"    && <AccountPanel />}
            {tab === "appearance" && <AppearancePanel />}
            {tab === "data"       && <PlaceholderPanel title="Data Management" description="Export and import features coming soon." />}
            {tab === "sync"       && <PlaceholderPanel title="Sync" description="Cloud sync features coming soon." />}
            {tab === "trash"      && <TrashPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}
