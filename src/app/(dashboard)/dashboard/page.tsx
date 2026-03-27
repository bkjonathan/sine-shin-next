"use client";

import { useState, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Plus, ShoppingBag, Users, Receipt, Settings, ShoppingCart, ArrowRight } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { CreateOrderInput } from "@/validations/order.schema";
import type { DashboardRecordType, DashboardDateField } from "@/types/dashboard";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ─── Main Page ───────────────────────────────────────────────────────────────

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
    <div className="space-y-6 max-w-[1400px]">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-t1">
            {getGreeting()},{" "}
            <span className="text-accent">{userName}</span>
          </h1>
          <p className="text-sm text-t3 mt-0.5">{todayLabel}</p>
        </div>
        <GlassButton onClick={() => setCreating(true)} size="sm">
          <Plus className="h-4 w-4" /> New Order
        </GlassButton>
      </div>

      {/* ── Filters ── */}
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

      {/* ── Stats Grid (6 clickable cards) ── */}
      <div>
        <p className="text-xs font-semibold tracking-widest text-t3 uppercase mb-3">
          Financial Overview
        </p>
        <DashboardStatsGrid
          stats={stats}
          isLoading={isLoading}
          onDrilldown={handleDrilldown}
        />
      </div>

      {/* ── Order & Customer Count badges ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-line">
          <ShoppingCart className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold text-t1">
            {isLoading ? "—" : (stats?.total_orders ?? 0)}
          </span>
          <span className="text-xs text-t3">Orders</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-line">
          <Users className="h-4 w-4 text-[#AF52DE]" />
          <span className="text-sm font-semibold text-t1">
            {isLoading ? "—" : (stats?.total_customers ?? 0)}
          </span>
          <span className="text-xs text-t3">Customers</span>
        </div>
        <Link
          href="/account"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-bg border border-accent-border text-accent text-xs font-medium hover:opacity-80 transition-opacity"
        >
          Account Book <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* ── Bottom: Recent Orders + Quick Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <DashboardRecentOrders
          orders={stats?.recent_orders ?? []}
          isLoading={isLoading}
        />

        {/* Quick Actions */}
        <GlassCard className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-t1 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: "/orders",    label: "Orders",    icon: ShoppingBag, bg: "bg-accent-bg",    text: "text-accent",    border: "border-accent-border"  },
              { href: "/customers", label: "Customers", icon: Users,        bg: "bg-[#AF52DE]/15", text: "text-[#AF52DE]", border: "border-[#AF52DE]/25"   },
              { href: "/expenses",  label: "Expenses",  icon: Receipt,      bg: "bg-[#30D158]/15", text: "text-[#30D158]", border: "border-[#30D158]/25"   },
              { href: "/settings",  label: "Settings",  icon: Settings,     bg: "bg-[#FF9F0A]/15", text: "text-[#FF9F0A]", border: "border-[#FF9F0A]/25"   },
            ].map(({ href, label, icon: Icon, bg, text, border }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border transition-all duration-200",
                  "hover:scale-105 hover:shadow-lg",
                  bg, border
                )}
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", bg, border)}>
                  <Icon className={cn("h-5 w-5", text)} />
                </div>
                <span className={cn("text-xs font-medium", text)}>{label}</span>
              </Link>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* ── Detail Drilldown Modal ── */}
      <DashboardDetailModal
        open={!!detailType}
        onOpenChange={(open) => { if (!open) setDetailType(null); }}
        type={detailType}
        records={detailRecords}
      />

      {/* ── New Order Modal ── */}
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
