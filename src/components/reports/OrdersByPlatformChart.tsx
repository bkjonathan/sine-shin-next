"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { GlassCard } from "@/components/ui/glass-card";
import { formatCurrency } from "@/lib/utils";
import { useCurrencyPrefs } from "@/hooks/use-currency-prefs";
import type { OrderByPlatform } from "@/types/reports";

interface OrdersByPlatformChartProps {
  data: OrderByPlatform[];
  isLoading: boolean;
}

const COLORS = ["#007AFF", "#30D158", "#FF9F0A", "#AF52DE", "#FF375F", "#32ADE6"];

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: OrderByPlatform }> }) {
  const { prefs } = useCurrencyPrefs();
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-2xl border border-line bg-modal p-3 shadow-[var(--shadow-card)] backdrop-blur-2xl">
      <p className="text-xs font-semibold text-t1">{d.platform}</p>
      <div className="mt-2 space-y-1">
        <p className="text-xs text-t2">
          Orders: <span className="font-medium text-t1">{d.count}</span>
        </p>
        <p className="text-xs text-t2">
          Revenue: <span className="font-medium text-t1">{formatCurrency(d.revenue, prefs.currencySymbol)}</span>
        </p>
      </div>
    </div>
  );
}

export function OrdersByPlatformChart({ data, isLoading }: OrdersByPlatformChartProps) {
  if (isLoading) {
    return (
      <GlassCard>
        <div className="h-[280px] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard padding="sm">
      <div className="mb-4 px-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-t4">Platform Distribution</p>
        <p className="mt-0.5 text-sm font-medium text-t2">Orders by source platform</p>
      </div>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={true} vertical={false} />
            <XAxis type="number" hide />
            <YAxis
              dataKey="platform"
              type="category"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "var(--text-2)" }}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--bg-surface-hover)" }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={40}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
