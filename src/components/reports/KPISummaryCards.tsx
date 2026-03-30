"use client";

import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Users,
  Receipt,
  Package,
  Percent,
  BarChart3,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useCurrencyPrefs } from "@/hooks/use-currency-prefs";
import type { KPISummary } from "@/types/reports";

interface KPISummaryCardsProps {
  kpi: KPISummary | null;
  isLoading: boolean;
}

interface KPICardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  trend?: string;
  delay?: number;
}

function KPICard({ label, value, icon: Icon, iconColor, iconBg, delay = 0 }: KPICardProps) {
  return (
    <div
      className="animate-fade-up relative overflow-hidden rounded-[22px] border border-line bg-surface p-4 sm:p-5 transition-all duration-300 hover:-translate-y-0.5 hover:bg-surface-hover hover:border-line-strong hover:[box-shadow:var(--shadow-card-hover)] [box-shadow:var(--shadow-sm)]"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Decorative glow */}
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-30 blur-2xl"
        style={{ background: iconBg.replace("/15", "/40") }}
      />

      <div className="relative">
        <div className="flex items-center justify-between">
          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
        <p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-t3">
          {label}
        </p>
        <p className="mt-1 text-lg font-bold tracking-tight text-t1 sm:text-xl">
          {value}
        </p>
      </div>
    </div>
  );
}

export function KPISummaryCards({ kpi, isLoading }: KPISummaryCardsProps) {
  const { prefs } = useCurrencyPrefs();
  const sym = prefs.currencySymbol;
  const v = (n: number | undefined) => (isLoading || !kpi ? "—" : formatCurrency(n ?? 0, sym));

  const cards: Omit<KPICardProps, "delay">[] = [
    {
      label: "Total Revenue",
      value: v(kpi?.totalRevenue),
      icon: DollarSign,
      iconColor: "text-[#007AFF]",
      iconBg: "bg-[#007AFF]/15",
    },
    {
      label: "Total Profit",
      value: v(kpi?.totalProfit),
      icon: TrendingUp,
      iconColor: "text-[#30D158]",
      iconBg: "bg-[#30D158]/15",
    },
    {
      label: "Profit Margin",
      value: isLoading || !kpi ? "—" : `${kpi.profitMargin}%`,
      icon: Percent,
      iconColor: "text-[#AF52DE]",
      iconBg: "bg-[#AF52DE]/15",
    },
    {
      label: "Avg Order Value",
      value: v(kpi?.avgOrderValue),
      icon: BarChart3,
      iconColor: "text-[#FF9F0A]",
      iconBg: "bg-[#FF9F0A]/15",
    },
    {
      label: "Total Orders",
      value: isLoading || !kpi ? "—" : String(kpi.totalOrders),
      icon: ShoppingCart,
      iconColor: "text-[#32ADE6]",
      iconBg: "bg-[#32ADE6]/15",
    },
    {
      label: "Total Customers",
      value: isLoading || !kpi ? "—" : String(kpi.totalCustomers),
      icon: Users,
      iconColor: "text-[#FF375F]",
      iconBg: "bg-[#FF375F]/15",
    },
    {
      label: "Total Expenses",
      value: v(kpi?.totalExpenses),
      icon: Receipt,
      iconColor: "text-[#FF3B30]",
      iconBg: "bg-[#FF3B30]/15",
    },
    {
      label: "Cargo Collection",
      value: isLoading || !kpi ? "—" : `${kpi.cargoCollectionRate}%`,
      icon: Package,
      iconColor: "text-[#FF9F0A]",
      iconBg: "bg-[#FF9F0A]/15",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card, i) => (
        <KPICard key={card.label} {...card} delay={i * 60} />
      ))}
    </div>
  );
}
