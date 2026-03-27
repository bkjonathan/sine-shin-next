"use client";

import {
  DollarSign, TrendingUp, TrendingDown, Package,
  CheckCircle, XCircle, Ban,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { DashboardStatCard } from "./DashboardStatCard";
import type { DashboardStats, DashboardRecordType } from "@/types/dashboard";

interface DashboardStatsGridProps {
  stats: DashboardStats | null;
  isLoading: boolean;
  onDrilldown: (type: DashboardRecordType) => void;
}

export function DashboardStatsGrid({
  stats,
  isLoading,
  onDrilldown,
}: DashboardStatsGridProps) {
  const v = (n: number | undefined) =>
    isLoading || !stats ? "—" : formatCurrency(n ?? 0);

  const profit = stats?.total_profit ?? 0;
  const positiveProfit = profit >= 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {/* 1 – Total Revenue (no drilldown, just sum of order prices) */}
      <DashboardStatCard
        label="Total Revenue"
        value={v(stats?.total_revenue)}
        icon={DollarSign}
        iconBg="bg-[#007AFF]/15"
        iconText="text-[#007AFF]"
      />

      {/* 2 – Total Profit */}
      <DashboardStatCard
        label="Total Profit"
        value={v(stats?.total_profit)}
        icon={positiveProfit ? TrendingUp : TrendingDown}
        iconBg={positiveProfit ? "bg-[#30D158]/15" : "bg-[#FF3B30]/15"}
        iconText={positiveProfit ? "text-[#30D158]" : "text-[#FF3B30]"}
        dot={positiveProfit ? "bg-[#30D158]" : "bg-[#FF3B30]"}
        recordType="profit"
        onDrilldown={onDrilldown}
      />

      {/* 3 – Total Cargo Fee */}
      <DashboardStatCard
        label="Total Cargo Fee"
        value={v(stats?.total_cargo_fee)}
        icon={Package}
        iconBg="bg-[#FF9F0A]/15"
        iconText="text-[#FF9F0A]"
        dot="bg-[#FF9F0A]"
        recordType="cargo"
        onDrilldown={onDrilldown}
      />

      {/* 4 – Paid Cargo */}
      <DashboardStatCard
        label="Paid Cargo"
        value={v(stats?.paid_cargo_fee)}
        icon={CheckCircle}
        iconBg="bg-[#30D158]/15"
        iconText="text-[#30D158]"
        recordType="paid_cargo"
        onDrilldown={onDrilldown}
      />

      {/* 5 – Unpaid Cargo */}
      <DashboardStatCard
        label="Unpaid Cargo"
        value={v(stats?.unpaid_cargo_fee)}
        icon={XCircle}
        iconBg="bg-[#FF3B30]/15"
        iconText="text-[#FF3B30]"
        dot="bg-[#FF3B30]"
        recordType="unpaid_cargo"
        onDrilldown={onDrilldown}
      />

      {/* 6 – Excluded Cargo */}
      <DashboardStatCard
        label="Excluded Cargo"
        value={v(stats?.excluded_cargo_total)}
        sub={<p className="text-xs text-t3">Waived cargo fees</p>}
        icon={Ban}
        iconBg="bg-[#AF52DE]/15"
        iconText="text-[#AF52DE]"
        dot="bg-[#AF52DE]"
        recordType="excluded_cargo"
        onDrilldown={onDrilldown}
      />
    </div>
  );
}
