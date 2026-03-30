"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { GlassCard } from "@/components/ui/glass-card";
import { formatCurrency } from "@/lib/utils";
import { useCurrencyPrefs } from "@/hooks/use-currency-prefs";
import type { TopCustomer } from "@/types/reports";

interface TopCustomersChartProps {
  data: TopCustomer[];
  isLoading: boolean;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: TopCustomer }> }) {
  const { prefs } = useCurrencyPrefs();
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-2xl border border-line bg-modal p-3 shadow-[var(--shadow-card)] backdrop-blur-2xl">
      <p className="text-xs font-semibold text-t1">{d.customerName}</p>
      <p className="text-[10px] text-t3 mb-2">{d.customerId}</p>
      <div className="space-y-1">
        <p className="text-xs text-t2">
          Revenue: <span className="font-medium text-t1">{formatCurrency(d.totalRevenue, prefs.currencySymbol)}</span>
        </p>
        <p className="text-xs text-t2">
          Orders: <span className="font-medium text-t1">{d.orderCount}</span>
        </p>
      </div>
    </div>
  );
}

export function TopCustomersChart({ data, isLoading }: TopCustomersChartProps) {
  if (isLoading) {
    return (
      <GlassCard>
        <div className="h-[340px] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard padding="sm">
      <div className="mb-4 px-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-t4">Top Customers</p>
        <p className="mt-0.5 text-sm font-medium text-t2">Highest revenue generating customers</p>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="customerName"
              tick={{ fontSize: 10, fill: "var(--text-3)" }}
              axisLine={false}
              tickLine={false}
              angle={-45}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-3)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--bg-surface-hover)" }} />
            <Bar dataKey="totalRevenue" fill="#AF52DE" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
