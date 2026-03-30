"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { GlassCard } from "@/components/ui/glass-card";
import type { OrderStatusBreakdown } from "@/types/reports";

interface OrderStatusChartProps {
  data: OrderStatusBreakdown[];
  isLoading: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#FF9F0A",
  ordered: "#007AFF",
  arrived: "#32ADE6",
  shipping: "#AF52DE",
  completed: "#30D158",
  cancelled: "#FF3B30",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  ordered: "Ordered",
  arrived: "Arrived",
  shipping: "Shipping",
  completed: "Completed",
  cancelled: "Cancelled",
};

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: OrderStatusBreakdown }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-2xl border border-line bg-modal p-3 shadow-[var(--shadow-card)] backdrop-blur-2xl">
      <p className="text-xs font-semibold text-t1">{STATUS_LABELS[d.status] ?? d.status}</p>
      <p className="text-xs text-t2 mt-1">{d.count} orders ({d.percentage}%)</p>
    </div>
  );
}

export function OrderStatusChart({ data, isLoading }: OrderStatusChartProps) {
  const totalOrders = data.reduce((s, d) => s + d.count, 0);

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
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-t4">Order Status</p>
        <p className="mt-0.5 text-sm font-medium text-t2">Distribution by status</p>
      </div>

      <div className="flex flex-col items-center">
        <div className="relative h-[200px] w-full max-w-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="count"
                stroke="none"
                animationBegin={200}
                animationDuration={800}
              >
                {data.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#64748b"} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-2xl font-bold text-t1">{totalOrders}</p>
            <p className="text-[10px] font-medium text-t3 uppercase tracking-wider">Total</p>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 px-2">
          {data.map((d) => (
            <div key={d.status} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: STATUS_COLORS[d.status] ?? "#64748b" }}
              />
              <span className="text-xs text-t2 truncate">{STATUS_LABELS[d.status] ?? d.status}</span>
              <span className="text-xs font-semibold text-t1 ml-auto">{d.count}</span>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
