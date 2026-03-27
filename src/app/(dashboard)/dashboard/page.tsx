"use client";

import { useState, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Plus,
  Receipt,
  Settings,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassModal } from "@/components/ui/glass-modal";
import { OrderForm } from "@/components/orders/order-form";
import { useCreateOrder } from "@/hooks/use-orders";
import { useDashboardData } from "@/hooks/useDashboardData";
import { DashboardFilters, type Period } from "@/components/dashboard/DashboardFilters";
import { DashboardStatsGrid } from "@/components/dashboard/DashboardStatsGrid";
import { DashboardDetailModal } from "@/components/dashboard/DashboardDetailModal";
import { DashboardRecentOrders } from "@/components/dashboard/DashboardRecentOrders";
import { buildDetailRecords } from "@/utils/calculations";
import { periodToDates, firstOfMonthStr, todayStr } from "@/utils/dateUtils";
import { cn, formatCurrency } from "@/lib/utils";
import type { CreateOrderInput } from "@/validations/order.schema";
import type { DashboardRecordType, DashboardDateField } from "@/types/dashboard";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function MetricChip({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[22px] border border-line bg-surface px-4 py-3 shadow-[var(--shadow-sm)]">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-t4">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold tracking-tight text-t1">{value}</p>
    </div>
  );
}

function DashboardPreviewIllustration({
  revenue,
  orders,
  customers,
}: {
  revenue: string;
  orders: number | string;
  customers: number | string;
}) {
  return (
    <div className="relative h-full min-h-[280px] overflow-hidden rounded-[28px] border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_30%),var(--bg-panel)] p-5">
      <div className="animate-float-slow absolute left-8 top-7 h-24 w-24 rounded-full blur-3xl" style={{ background: "var(--accent-bg)" }} />
      <div className="animate-float-reverse absolute bottom-10 right-10 h-28 w-28 rounded-full blur-3xl" style={{ background: "var(--gradient-blob-2)" }} />

      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-t4">
              Live snapshot
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-t1">
              Momentum in motion
            </h2>
          </div>
          <div className="rounded-2xl border border-accent-border bg-accent-bg p-3 text-accent shadow-[0_14px_30px_var(--accent-shadow)]">
            <BarChart3 className="h-5 w-5" />
          </div>
        </div>

        <div className="grid gap-3">
          <div className="animate-fade-up rounded-[24px] border border-line bg-surface px-4 py-4 shadow-[var(--shadow-sm)]">
            <p className="text-xs text-t3">Revenue focus</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-t1">{revenue}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="animate-fade-up animation-delay-1 rounded-[22px] border border-line bg-surface px-4 py-3 shadow-[var(--shadow-sm)]">
              <p className="text-xs text-t3">Orders</p>
              <p className="mt-2 text-xl font-semibold text-t1">{orders}</p>
            </div>
            <div className="animate-fade-up animation-delay-2 rounded-[22px] border border-line bg-surface px-4 py-3 shadow-[var(--shadow-sm)]">
              <p className="text-xs text-t3">Customers</p>
              <p className="mt-2 text-xl font-semibold text-t1">{customers}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [creating, setCreating] = useState(false);
  const createOrder = useCreateOrder();

  // Filters
  const [period, setPeriod]         = useState<Period>("month");
  const [dateField, setDateField]   = useState<DashboardDateField>("order_date");
  const [statusFilter, setStatus]   = useState("");
  const [customFrom, setCustomFrom] = useState(firstOfMonthStr);
  const [customTo, setCustomTo]     = useState(todayStr);

  // Drilldown modal
  const [detailType, setDetailType] = useState<DashboardRecordType | null>(null);

  const filters = useMemo(() => {
    const dates =
      period === "custom"
        ? { from: customFrom, to: customTo }
        : periodToDates(period) ?? { from: customFrom, to: customTo };

    return {
      date_from:  dates.from,
      date_to:    dates.to,
      date_field: dateField,
      status:     statusFilter || null,
    };
  }, [period, dateField, statusFilter, customFrom, customTo]);

  const { orders, stats, isLoading } = useDashboardData(filters);

  const handleDrilldown = useCallback((type: DashboardRecordType) => {
    setDetailType(type);
  }, []);

  const detailRecords = useMemo(() => {
    if (!detailType || orders.length === 0) return [];
    return buildDetailRecords(orders, detailType);
  }, [orders, detailType]);

  const userName   = session?.user?.name ?? "there";
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="max-w-[1400px] space-y-6">
      <GlassCard padding="none" className="overflow-hidden">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="relative p-6 sm:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_36%)]" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent-border bg-accent-bg px-3 py-1.5 text-xs font-medium text-accent">
                <Sparkles className="h-3.5 w-3.5" />
                Daily operations overview
              </div>

              <h1 className="mt-5 max-w-2xl text-3xl font-semibold tracking-tight text-t1 sm:text-4xl">
                {getGreeting()}, <span className="text-accent">{userName}</span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-t2 sm:text-base">
                Stay on top of orders, customer activity, and cash movement from one responsive workspace that works cleanly in both themes.
              </p>
              <p className="mt-2 text-sm text-t3">{todayLabel}</p>

              <div className="mt-6 flex flex-wrap gap-3">
                <GlassButton onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" /> New Order
                </GlassButton>
                <GlassButton variant="secondary" asChild>
                  <Link href="/account">
                    Account Book <ArrowRight className="h-4 w-4" />
                  </Link>
                </GlassButton>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                <MetricChip
                  label="Orders"
                  value={isLoading ? "—" : (stats?.total_orders ?? 0)}
                />
                <MetricChip
                  label="Customers"
                  value={isLoading ? "—" : (stats?.total_customers ?? 0)}
                />
                <MetricChip
                  label="Profit"
                  value={isLoading ? "—" : formatCurrency(stats?.net_profit ?? 0)}
                />
              </div>
            </div>
          </div>

          <div className="p-6 pt-0 sm:px-8 lg:p-8 lg:pl-0">
            <DashboardPreviewIllustration
              revenue={isLoading ? "—" : formatCurrency(stats?.total_sales ?? 0)}
              orders={isLoading ? "—" : (stats?.total_orders ?? 0)}
              customers={isLoading ? "—" : (stats?.total_customers ?? 0)}
            />
          </div>
        </div>
      </GlassCard>

      <DashboardFilters
        period={period}
        onPeriodChange={setPeriod}
        dateField={dateField}
        onDateFieldChange={setDateField}
        statusFilter={statusFilter}
        onStatusChange={setStatus}
        customFrom={customFrom}
        onCustomFromChange={setCustomFrom}
        customTo={customTo}
        onCustomToChange={setCustomTo}
      />

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-t4">
          Financial Overview
        </p>
        <DashboardStatsGrid
          stats={stats}
          isLoading={isLoading}
          onDrilldown={handleDrilldown}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.55fr_1fr]">
        <DashboardRecentOrders
          orders={stats?.recent_orders ?? []}
          isLoading={isLoading}
        />

        <div className="space-y-4">
          <GlassCard>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-t4">
                  Shortcuts
                </p>
                <h3 className="mt-1 text-lg font-semibold text-t1">Quick Actions</h3>
              </div>
              <div className="rounded-2xl border border-line bg-surface p-2.5 text-accent">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              { href: "/orders", label: "Orders", icon: ShoppingBag, bg: "bg-accent-bg", text: "text-accent", border: "border-accent-border", note: "Manage active orders" },
              { href: "/customers", label: "Customers", icon: Users, bg: "bg-[rgba(50,184,255,0.14)]", text: "text-info", border: "border-[rgba(50,184,255,0.22)]", note: "Open customer profiles" },
              { href: "/expenses", label: "Expenses", icon: Receipt, bg: "bg-[rgba(49,201,126,0.14)]", text: "text-success", border: "border-[rgba(49,201,126,0.22)]", note: "Track spending" },
              { href: "/settings", label: "Settings", icon: Settings, bg: "bg-[rgba(255,176,32,0.14)]", text: "text-warning", border: "border-[rgba(255,176,32,0.22)]", note: "Tune shop details" },
            ].map(({ href, label, icon: Icon, bg, text, border, note }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group flex flex-col gap-3 rounded-[24px] border px-4 py-4 transition-all duration-300",
                  "hover:-translate-y-1 hover:shadow-[var(--shadow-card)]",
                  bg, border
                )}
              >
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl border transition-transform duration-300 group-hover:scale-105", bg, border)}>
                  <Icon className={cn("h-5 w-5", text)} />
                </div>
                <div>
                  <p className={cn("text-sm font-semibold", text)}>{label}</p>
                  <p className="mt-1 text-xs text-t2">{note}</p>
                </div>
              </Link>
            ))}
            </div>
          </GlassCard>

          <GlassCard>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-t4">
              Current filter
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                `Range: ${period === "custom" ? "Custom" : period}`,
                `Date field: ${dateField === "order_date" ? "Order date" : "Created date"}`,
                `Status: ${statusFilter || "All"}`,
              ].map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-t2"
                >
                  {item}
                </span>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>

      <DashboardDetailModal
        open={!!detailType}
        onOpenChange={(open) => { if (!open) setDetailType(null); }}
        type={detailType}
        records={detailRecords}
      />

      <GlassModal open={creating} onOpenChange={setCreating} title="New Order" size="lg">
        <OrderForm
          onSubmit={(d: CreateOrderInput) =>
            createOrder.mutate(d, { onSuccess: () => setCreating(false) })
          }
          isLoading={createOrder.isPending}
          onCancel={() => setCreating(false)}
        />
      </GlassModal>
    </div>
  );
}
