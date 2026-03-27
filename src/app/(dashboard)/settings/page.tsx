"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Settings, User, Palette, Database, Cloud,
  Sun, Moon, Check,
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
import { PageHeader } from "@/components/layout/page-header";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "general" | "account" | "appearance" | "data" | "sync";

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
            </p>
          </div>

          <div className="mt-2">
            {tab === "general"    && <GeneralPanel />}
            {tab === "account"    && <AccountPanel />}
            {tab === "appearance" && <AppearancePanel />}
            {tab === "data"       && <PlaceholderPanel title="Data Management" description="Export and import features coming soon." />}
            {tab === "sync"       && <PlaceholderPanel title="Sync" description="Cloud sync features coming soon." />}
          </div>
        </div>
      </div>
    </div>
  );
}
