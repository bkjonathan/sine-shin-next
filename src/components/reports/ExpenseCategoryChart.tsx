"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { GlassCard } from "@/components/ui/glass-card";
import { formatCurrency } from "@/lib/utils";
import { useCurrencyPrefs } from "@/hooks/use-currency-prefs";
import type { ExpenseByCategory } from "@/types/reports";

interface ExpenseCategoryChartProps {
  data: ExpenseByCategory[];
  isLoading: boolean;
}

const COLORS = ["#FF3B30", "#FF9F0A", "#FFD60A", "#30D158", "#32ADE6", "#007AFF", "#AF52DE", "#FF375F"];

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ExpenseByCategory }> }) {
  const { prefs } = useCurrencyPrefs();
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-2xl border border-line bg-modal p-3 shadow-[var(--shadow-card)] backdrop-blur-2xl">
      <p className="text-xs font-semibold capitalize text-t1">{d.category}</p>
      <p className="text-xs text-t2 mt-1">
        {formatCurrency(d.amount, prefs.currencySymbol)} ({d.percentage}%)
      </p>
    </div>
  );
}

export function ExpenseCategoryChart({ data, isLoading }: ExpenseCategoryChartProps) {
  const { prefs } = useCurrencyPrefs();
  const total = data.reduce((s, d) => s + d.amount, 0);

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
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-t4">Expenses</p>
        <p className="mt-0.5 text-sm font-medium text-t2">Distribution by category</p>
      </div>

      <div className="flex flex-col items-center">
        <div className="relative h-[200px] w-full max-w-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={85}
                paddingAngle={2}
                dataKey="amount"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-sm font-bold text-t1">{formatCurrency(total, prefs.currencySymbol)}</p>
            <p className="text-[10px] font-medium text-t3 uppercase tracking-wider">Total</p>
          </div>
        </div>

        <div className="mt-4 grid w-full grid-cols-2 gap-x-4 gap-y-2 px-4">
          {data.map((d, i) => (
            <div key={d.category} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span className="text-xs text-t2 capitalize truncate">{d.category}</span>
              <span className="text-xs font-semibold text-t1 ml-auto">{d.percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
