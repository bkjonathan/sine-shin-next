"use client";

import Link from "next/link";
import {
  Plane, Scale, ArrowDownRight, ArrowUpRight, TrendingUp, TrendingDown, ArrowRight,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { CargoStatusBadge } from "@/components/cargo/cargo-status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useCurrencyPrefs } from "@/hooks/use-currency-prefs";
import { DashboardStatCard } from "./DashboardStatCard";
import type { DashboardCargoData } from "@/types/dashboard";

interface DashboardCargoOverviewProps {
  cargo: DashboardCargoData | null;
  isLoading: boolean;
}

export function DashboardCargoOverview({ cargo, isLoading }: DashboardCargoOverviewProps) {
  const { prefs } = useCurrencyPrefs();
  const stats = cargo?.stats;
  const recent = cargo?.recent ?? [];

  const money = (n: number | undefined) =>
    isLoading || !stats ? "—" : formatCurrency(n ?? 0, prefs.currencySymbol);

  const profit = (stats?.receiver_owed ?? 0) - (stats?.carrier_owed ?? 0);
  const positiveProfit = profit >= 0;

  const activeCount = (stats?.pending ?? 0) + (stats?.in_transit ?? 0) + (stats?.arrived ?? 0);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-t4">
          Cargo Overview
        </p>
        <Link
          href="/cargo"
          className="flex items-center gap-1 text-xs text-accent hover:opacity-80"
        >
          View All <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <DashboardStatCard
          label="Shipments"
          value={isLoading || !stats ? "—" : stats.total_shipments}
          sub={
            <p className="text-xs text-t3">
              {isLoading || !stats ? " " : `${activeCount} active · ${stats.delivered} delivered`}
            </p>
          }
          icon={Plane}
          iconBg="bg-[#007AFF]/15"
          iconText="text-[#007AFF]"
        />
        <DashboardStatCard
          label="Total Weight"
          value={isLoading || !stats ? "—" : `${stats.total_weight.toFixed(2)} kg`}
          icon={Scale}
          iconBg="bg-[#64D2FF]/15"
          iconText="text-[#64D2FF]"
        />
        <DashboardStatCard
          label="Carrier Cost"
          value={money(stats?.carrier_owed)}
          sub={<p className="text-xs text-t3">Owed to carriers</p>}
          icon={ArrowDownRight}
          iconBg="bg-[#FF9F0A]/15"
          iconText="text-[#FF9F0A]"
        />
        <DashboardStatCard
          label="Receiver Revenue"
          value={money(stats?.receiver_owed)}
          sub={<p className="text-xs text-t3">Owed by receivers</p>}
          icon={ArrowUpRight}
          iconBg="bg-[#30D158]/15"
          iconText="text-[#30D158]"
        />
        <DashboardStatCard
          label="Cargo Profit"
          value={money(profit)}
          icon={positiveProfit ? TrendingUp : TrendingDown}
          iconBg={positiveProfit ? "bg-[#30D158]/15" : "bg-[#FF3B30]/15"}
          iconText={positiveProfit ? "text-[#30D158]" : "text-[#FF3B30]"}
          dot={positiveProfit ? "bg-[#30D158]" : "bg-[#FF3B30]"}
        />
      </div>

      <GlassCard padding="none" className="mt-4">
        <div className="flex items-center justify-between border-b border-divide px-5 py-4">
          <h3 className="text-sm font-semibold text-t1">Recent Shipments</h3>
          <Link
            href="/cargo"
            className="flex items-center gap-1 text-xs text-accent hover:opacity-80"
          >
            View All <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="divide-y divide-divide">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5 animate-pulse">
                <div className="h-9 w-9 shrink-0 rounded-2xl bg-surface" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-28 rounded bg-surface" />
                  <div className="h-2.5 w-20 rounded bg-surface" />
                </div>
                <div className="h-3 w-16 rounded bg-surface" />
              </div>
            ))
          ) : recent.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-t3">
              No cargo shipments for this period
            </p>
          ) : (
            recent.map((s) => {
              const rowProfit = (s.receiverOwed ?? 0) - (s.carrierOwed ?? 0);
              return (
                <Link
                  key={s.id}
                  href={`/cargo/${s.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-hover"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-accent-bg text-accent">
                    <Plane className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm font-medium text-t1">
                      {s.cargoNo}
                    </p>
                    <p className="truncate text-xs text-t3">
                      {s.carrierName ?? "—"} · {(s.totalWeight ?? 0).toFixed(2)} kg
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <p
                      className={
                        rowProfit >= 0
                          ? "text-sm font-semibold text-success"
                          : "text-sm font-semibold text-danger"
                      }
                    >
                      {formatCurrency(rowProfit, prefs.currencySymbol)}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <CargoStatusBadge status={s.status} />
                      <span className="text-xs text-t3">
                        {formatDate(s.createdAt, "d MMM")}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </GlassCard>
    </div>
  );
}
