"use client";

import { useState, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowRight, Plus, Sparkles } from "lucide-react";
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
import { formatCurrency } from "@/lib/utils";
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
    <div className="rounded-2xl border border-line bg-surface px-3 py-2 shadow-[var(--shadow-sm)] text-center">
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-t4 truncate">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tracking-tight text-t1 sm:text-base">{value}</p>
    </div>
  );
}

function RevenueChip({ revenue }: { revenue: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface px-3 py-2 shadow-[var(--shadow-sm)] text-center h-full flex flex-col justify-center">
      <div className="animate-float-slow absolute -left-4 -top-4 h-12 w-12 rounded-full blur-2xl" style={{ background: "var(--accent-bg)" }} />
      <div className="relative">
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-t4 truncate">
          Revenue
        </p>
        <p className="mt-0.5 text-sm font-semibold tracking-tight text-t1 sm:text-base">{revenue}</p>
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

      <GlassCard padding="none" className="overflow-hidden">
        <div className="relative p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_36%)]" />
          <div className="relative space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent-border bg-accent-bg px-3 py-1.5 text-xs font-medium text-accent">
                <Sparkles className="h-3.5 w-3.5" />
                Daily operations overview
              </div>
              <p className="text-xs text-t3 hidden sm:block">{todayLabel}</p>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight text-t1 sm:text-3xl">
                  {getGreeting()}, <span className="text-accent">{userName}</span>
                </h1>
                <p className="max-w-lg text-sm leading-6 text-t2">
                  Stay on top of orders, customer activity, and cash movement from one responsive workspace.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <GlassButton onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" /> New Order
                </GlassButton>
                <GlassButton variant="secondary" asChild>
                  <Link href="/account">
                    Account Book <ArrowRight className="h-4 w-4" />
                  </Link>
                </GlassButton>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 lg:grid-cols-4">
              <MetricChip
                label="Orders"
                value={isLoading ? "—" : (stats?.total_orders ?? 0)}
              />
              <MetricChip
                label="Customers"
                value={isLoading ? "—" : (stats?.total_customers ?? 0)}
              />
              <MetricChip
                label="Net profit"
                value={isLoading ? "—" : formatCurrency(stats?.total_profit ?? 0)}
              />
              <div className="col-span-3 lg:col-span-1">
                <RevenueChip
                  revenue={isLoading ? "—" : formatCurrency(stats?.total_revenue ?? 0)}
                />
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

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

      <DashboardRecentOrders
        orders={stats?.recent_orders ?? []}
        isLoading={isLoading}
      />

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
