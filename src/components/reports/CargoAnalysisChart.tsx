"use client";

import {
  BarChart,
  Bar,
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
import type { MonthlyCargo } from "@/types/reports";

interface CargoAnalysisChartProps {
  data: MonthlyCargo[];
  isLoading: boolean;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  const { prefs } = useCurrencyPrefs();
  if (!active || !payload) return null;
  return (
    <div className="rounded-2xl border border-line bg-modal p-3.5 shadow-[var(--shadow-card)] backdrop-blur-2xl">
      <p className="text-xs font-semibold text-t1 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs text-t2">
          <span className="w-16 capitalize">{entry.name}:</span>
          <span className="font-semibold text-t1">
            {formatCurrency(entry.value, prefs.currencySymbol)}
          </span>
        </div>
      ))}
      <div className="mt-2 pt-2 border-t border-line text-xs font-semibold text-t1">
        Total: {formatCurrency(payload.reduce((s, p) => s + p.value, 0), prefs.currencySymbol)}
      </div>
    </div>
  );
}

export function CargoAnalysisChart({ data, isLoading }: CargoAnalysisChartProps) {
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
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-t4">Cargo Analytics</p>
        <p className="mt-0.5 text-sm font-medium text-t2">Paid vs Unpaid freight tracking</p>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--bg-surface-hover)" }} />
            <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
            <Bar dataKey="paid" name="Paid" stackId="a" fill="#30D158" radius={[0, 0, 4, 4]} maxBarSize={40} />
            <Bar dataKey="unpaid" name="Unpaid" stackId="a" fill="#FF3B30" maxBarSize={40} />
            <Bar dataKey="excluded" name="Excluded" stackId="a" fill="#AF52DE" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
