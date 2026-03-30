"use client";

import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { GlassCard } from "@/components/ui/glass-card";
import { formatCurrency } from "@/lib/utils";
import { useCurrencyPrefs } from "@/hooks/use-currency-prefs";
import type { MonthlyRevenue } from "@/types/reports";

interface MonthlyOrderVolumeChartProps {
  data: MonthlyRevenue[];
  isLoading: boolean;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  const { prefs } = useCurrencyPrefs();
  if (!active || !payload) return null;
  
  const orderCount = payload.find(p => p.dataKey === "orderCount")?.value;
  const avgValue = payload.find(p => p.dataKey === "avgOrderValue")?.value;

  return (
    <div className="rounded-2xl border border-line bg-modal p-3.5 shadow-[var(--shadow-card)] backdrop-blur-2xl">
      <p className="text-xs font-semibold text-t1 mb-2">{label}</p>
      <div className="space-y-1">
        <p className="text-xs text-t2 flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#007AFF]"></span>
            Orders
          </span>
          <span className="font-semibold text-t1">{orderCount}</span>
        </p>
        <p className="text-xs text-t2 flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#FF9F0A]"></span>
            Avg Order Value
          </span>
          <span className="font-semibold text-t1">{formatCurrency(avgValue ?? 0, prefs.currencySymbol)}</span>
        </p>
      </div>
    </div>
  );
}

export function MonthlyOrderVolumeChart({ data, isLoading }: MonthlyOrderVolumeChartProps) {
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
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-t4">Order Volume</p>
        <p className="mt-0.5 text-sm font-medium text-t2">Monthly counts and average values</p>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--text-3)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: "var(--text-3)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: "var(--text-3)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--bg-surface-hover)" }} />
            <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
            <Bar
              yAxisId="left"
              dataKey="orderCount"
              name="Orders"
              fill="#007AFF"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avgOrderValue"
              name="Avg Order Value"
              stroke="#FF9F0A"
              strokeWidth={3}
              dot={{ r: 4, fill: "#FF9F0A", stroke: "var(--bg-card)", strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
