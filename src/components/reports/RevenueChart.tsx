"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { GlassCard } from "@/components/ui/glass-card";
import { formatCurrency } from "@/lib/utils";
import { useCurrencyPrefs } from "@/hooks/use-currency-prefs";
import type { MonthlyRevenue } from "@/types/reports";

interface RevenueChartProps {
  data: MonthlyRevenue[];
  isLoading: boolean;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  const { prefs } = useCurrencyPrefs();
  if (!active || !payload) return null;
  return (
    <div className="rounded-2xl border border-line bg-modal p-3.5 shadow-[var(--shadow-card)] backdrop-blur-2xl">
      <p className="text-xs font-semibold text-t1 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs text-t2">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span className="min-w-[60px]">{entry.name}:</span>
          <span className="font-semibold text-t1">{formatCurrency(entry.value, prefs.currencySymbol)}</span>
        </div>
      ))}
    </div>
  );
}

export function RevenueChart({ data, isLoading }: RevenueChartProps) {
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
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-t4">Revenue Trends</p>
        <p className="mt-0.5 text-sm font-medium text-t2">Revenue, Profit & Expenses over time</p>
      </div>
      <div className="h-[300px] sm:h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="gr-revenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#007AFF" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#007AFF" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gr-profit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#30D158" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#30D158" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gr-expenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FF375F" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#FF375F" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--text-3)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-3)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
              formatter={(value: string) => <span className="text-t2">{value}</span>}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke="#007AFF"
              strokeWidth={2.5}
              fill="url(#gr-revenue)"
              dot={false}
              activeDot={{ r: 5, fill: "#007AFF", stroke: "var(--bg-surface)", strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="profit"
              name="Profit"
              stroke="#30D158"
              strokeWidth={2}
              fill="url(#gr-profit)"
              dot={false}
              activeDot={{ r: 4, fill: "#30D158", stroke: "var(--bg-surface)", strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              name="Expenses"
              stroke="#FF375F"
              strokeWidth={2}
              fill="url(#gr-expenses)"
              dot={false}
              activeDot={{ r: 4, fill: "#FF375F", stroke: "var(--bg-surface)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
