"use client";

import { useState, useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { ReportFilters, type ReportPeriod } from "@/components/reports/ReportFilters";
import { KPISummaryCards } from "@/components/reports/KPISummaryCards";
import { RevenueChart } from "@/components/reports/RevenueChart";
import { OrderStatusChart } from "@/components/reports/OrderStatusChart";
import { OrdersByPlatformChart } from "@/components/reports/OrdersByPlatformChart";
import { TopCustomersChart } from "@/components/reports/TopCustomersChart";
import { ExpenseCategoryChart } from "@/components/reports/ExpenseCategoryChart";
import { CargoAnalysisChart } from "@/components/reports/CargoAnalysisChart";
import { MonthlyOrderVolumeChart } from "@/components/reports/MonthlyOrderVolumeChart";
import { CustomerGrowthChart } from "@/components/reports/CustomerGrowthChart";
import { useReportsData } from "@/hooks/use-reports";
import { periodToDates, firstOfMonthStr, todayStr } from "@/utils/dateUtils";

export default function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>("6months");
  const [customFrom, setCustomFrom] = useState(firstOfMonthStr());
  const [customTo, setCustomTo] = useState(todayStr());

  const filters = useMemo(() => {
    if (period === "all") return {};
    const dates =
      period === "custom"
        ? { from: customFrom, to: customTo }
        : periodToDates(period) ?? { from: customFrom, to: customTo };

    return { dateFrom: dates.from, dateTo: dates.to };
  }, [period, customFrom, customTo]);

  const { data, isLoading } = useReportsData(filters);

  return (
    <div className="max-w-[1400px] space-y-6 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-bg text-accent">
              <BarChart3 className="h-4.5 w-4.5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-t1 sm:text-3xl">
              Business Reports
            </h1>
          </div>
          <p className="mt-1 text-sm text-t2">
            Deep insights into operations, revenue, and customer patterns.
          </p>
        </div>

        <ReportFilters
          period={period}
          onPeriodChange={setPeriod}
          customFrom={customFrom}
          onCustomFromChange={setCustomFrom}
          customTo={customTo}
          onCustomToChange={setCustomTo}
        />
      </div>

      <KPISummaryCards kpi={data?.kpi ?? null} isLoading={isLoading} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart data={data?.monthlyRevenue ?? []} isLoading={isLoading} />
        </div>
        <div className="lg:col-span-1">
          <OrderStatusChart data={data?.ordersByStatus ?? []} isLoading={isLoading} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MonthlyOrderVolumeChart data={data?.monthlyRevenue ?? []} isLoading={isLoading} />
        <OrdersByPlatformChart data={data?.ordersByPlatform ?? []} isLoading={isLoading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopCustomersChart data={data?.topCustomers ?? []} isLoading={isLoading} />
        <ExpenseCategoryChart data={data?.expensesByCategory ?? []} isLoading={isLoading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CargoAnalysisChart data={data?.monthlyCargo ?? []} isLoading={isLoading} />
        <CustomerGrowthChart data={data?.customerGrowth ?? []} isLoading={isLoading} />
      </div>
    </div>
  );
}
