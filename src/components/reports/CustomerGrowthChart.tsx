"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { GlassCard } from "@/components/ui/glass-card";
import type { CustomerGrowthPoint } from "@/types/reports";

interface CustomerGrowthChartProps {
  data: CustomerGrowthPoint[];
  isLoading: boolean;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload) return null;
  
  const cumulative = payload.find(p => p.dataKey === "cumulativeCustomers")?.value;
  const newCust = payload.find(p => p.dataKey === "newCustomers")?.value;

  return (
    <div className="rounded-2xl border border-line bg-modal p-3.5 shadow-[var(--shadow-card)] backdrop-blur-2xl">
      <p className="text-xs font-semibold text-t1 mb-2">{label}</p>
      <div className="space-y-1 text-xs text-t2">
        <p className="flex justify-between gap-4">
          <span>Total Customers:</span>
          <span className="font-semibold text-t1">{cumulative}</span>
        </p>
        <p className="flex justify-between gap-4">
          <span>New This Month:</span>
          <span className="font-semibold text-[#32ADE6]">+{newCust}</span>
        </p>
      </div>
    </div>
  );
}

export function CustomerGrowthChart({ data, isLoading }: CustomerGrowthChartProps) {
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
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-t4">Customer Growth</p>
        <p className="mt-0.5 text-sm font-medium text-t2">Cumulative acquisition tracking</p>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="gr-customers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#32ADE6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#32ADE6" stopOpacity={0} />
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
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="cumulativeCustomers"
              stroke="#32ADE6"
              strokeWidth={3}
              fill="url(#gr-customers)"
              dot={false}
              activeDot={{ r: 6, fill: "#32ADE6", stroke: "var(--bg-surface)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
