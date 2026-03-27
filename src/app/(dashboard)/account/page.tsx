"use client";

import { useState } from "react";
import { useAccountSummary } from "@/hooks/useAccountSummary";
import { GlassCard } from "@/components/ui/glass-card";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, DollarSign, Receipt,
  ShoppingCart, Package, Percent, Tag, BarChart2,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react";

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryRow({
  label,
  value,
  icon: Icon,
  iconColor,
  bold,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  iconColor: string;
  bold?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between py-3 border-b border-divide last:border-0", bold && "font-semibold")}>
      <div className="flex items-center gap-2 text-t2">
        <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
        <span className={cn("text-sm", bold ? "text-t1" : "text-t2")}>{label}</span>
      </div>
      <span className={cn("text-sm tabular-nums", bold ? "text-t1" : "text-t2")}>{value}</span>
    </div>
  );
}

type Tab = "summary" | "income" | "expenses";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const [tab, setTab] = useState<Tab>("summary");
  const { summary, isLoading } = useAccountSummary();

  const v = (n: number | undefined) =>
    isLoading || !summary ? "—" : formatCurrency(n ?? 0);

  const netBalance = summary?.net_balance ?? 0;
  const netPositive = netBalance >= 0;

  return (
    <div className="space-y-6 max-w-[900px]">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-t1">Account Book</h1>
        <p className="text-sm text-t3 mt-0.5">Income, expenses, and net balance summary</p>
      </div>

      {/* ── Net Balance Hero ── */}
      <GlassCard className={cn(
        "flex flex-col gap-2 border-2",
        netPositive ? "border-[#30D158]/30 bg-[#30D158]/5" : "border-[#FF3B30]/30 bg-[#FF3B30]/5"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center",
            netPositive ? "bg-[#30D158]/20" : "bg-[#FF3B30]/20"
          )}>
            {netPositive
              ? <ArrowUpRight className="h-6 w-6 text-[#30D158]" />
              : <ArrowDownRight className="h-6 w-6 text-[#FF3B30]" />
            }
          </div>
          <div>
            <p className="text-xs font-semibold tracking-widest text-t3 uppercase">Net Balance</p>
            <p className={cn(
              "text-3xl font-bold mt-0.5",
              netPositive ? "text-[#30D158]" : "text-[#FF3B30]"
            )}>
              {isLoading ? "—" : formatCurrency(netBalance)}
            </p>
          </div>
        </div>
        <p className="text-xs text-t3 ml-15">
          Total income minus total expenses across all time
        </p>
      </GlassCard>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 p-1 bg-surface rounded-xl border border-line w-fit">
        {(["summary", "income", "expenses"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all duration-150",
              tab === t
                ? "bg-accent text-white [box-shadow:0_2px_8px_var(--accent-shadow)]"
                : "text-t2 hover:text-t1"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {tab === "summary" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Income summary */}
          <GlassCard>
            <h3 className="text-sm font-semibold text-t1 mb-1">Income</h3>
            <p className="text-xs text-t3 mb-4">Revenue earned by the shop</p>
            <SummaryRow
              label="Total Income (all time)"
              value={v(summary?.total_income)}
              icon={TrendingUp}
              iconColor="text-[#30D158]"
              bold
            />
            <SummaryRow
              label="This Month"
              value={v(summary?.this_month_income)}
              icon={BarChart2}
              iconColor="text-[#007AFF]"
            />
            <SummaryRow
              label="Service Fees"
              value={v(summary?.total_service_fee)}
              icon={Percent}
              iconColor="text-[#AF52DE]"
            />
            <SummaryRow
              label="Product Discounts"
              value={v(summary?.total_product_discount)}
              icon={Tag}
              iconColor="text-[#FF9F0A]"
            />
            <SummaryRow
              label="Cargo Fees (effective)"
              value={v(summary?.total_cargo_fee)}
              icon={Package}
              iconColor="text-[#FF9F0A]"
            />
            <SummaryRow
              label="Total Orders"
              value={isLoading ? "—" : String(summary?.total_orders ?? 0)}
              icon={ShoppingCart}
              iconColor="text-[#007AFF]"
            />
          </GlassCard>

          {/* Expense summary */}
          <GlassCard>
            <h3 className="text-sm font-semibold text-t1 mb-1">Expenses</h3>
            <p className="text-xs text-t3 mb-4">Costs incurred by the business</p>
            <SummaryRow
              label="Total Expenses (all time)"
              value={v(summary?.total_expenses)}
              icon={TrendingDown}
              iconColor="text-[#FF3B30]"
              bold
            />
            <SummaryRow
              label="This Month"
              value={v(summary?.this_month_expenses)}
              icon={BarChart2}
              iconColor="text-[#007AFF]"
            />
            <SummaryRow
              label="Expense Records"
              value={isLoading ? "—" : String(summary?.total_expense_records ?? 0)}
              icon={Receipt}
              iconColor="text-[#FF9F0A]"
            />
          </GlassCard>

          {/* Net balance breakdown */}
          <GlassCard className="md:col-span-2">
            <h3 className="text-sm font-semibold text-t1 mb-4">Balance Breakdown</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total Income",   value: v(summary?.total_income),   color: "text-[#30D158]", icon: TrendingUp   },
                { label: "Total Expenses", value: v(summary?.total_expenses),  color: "text-[#FF3B30]", icon: TrendingDown },
                { label: "Net Balance",    value: isLoading ? "—" : formatCurrency(netBalance), color: netPositive ? "text-[#30D158]" : "text-[#FF3B30]", icon: DollarSign },
              ].map(({ label, value, color, icon: Icon }) => (
                <div key={label} className="text-center p-4 rounded-xl bg-surface border border-line">
                  <Icon className={cn("h-5 w-5 mx-auto mb-2", color)} />
                  <p className="text-xs text-t3 mb-1">{label}</p>
                  <p className={cn("text-lg font-bold tabular-nums", color)}>{value}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {tab === "income" && (
        <GlassCard>
          <h3 className="text-sm font-semibold text-t1 mb-1">Income Details</h3>
          <p className="text-xs text-t3 mb-6">Breakdown of all income sources</p>
          <SummaryRow label="Total Income" value={v(summary?.total_income)} icon={TrendingUp} iconColor="text-[#30D158]" bold />
          <SummaryRow label="This Month" value={v(summary?.this_month_income)} icon={BarChart2} iconColor="text-[#007AFF]" />
          <SummaryRow label="Service Fees Collected" value={v(summary?.total_service_fee)} icon={Percent} iconColor="text-[#AF52DE]" />
          <SummaryRow label="Product Discounts Applied" value={v(summary?.total_product_discount)} icon={Tag} iconColor="text-[#FF9F0A]" />
          <SummaryRow label="Effective Cargo Fees" value={v(summary?.total_cargo_fee)} icon={Package} iconColor="text-[#FF9F0A]" />
          <SummaryRow label="Orders Processed" value={isLoading ? "—" : String(summary?.total_orders ?? 0)} icon={ShoppingCart} iconColor="text-[#007AFF]" />
        </GlassCard>
      )}

      {tab === "expenses" && (
        <GlassCard>
          <h3 className="text-sm font-semibold text-t1 mb-1">Expense Details</h3>
          <p className="text-xs text-t3 mb-6">Breakdown of all business expenses</p>
          <SummaryRow label="Total Expenses" value={v(summary?.total_expenses)} icon={TrendingDown} iconColor="text-[#FF3B30]" bold />
          <SummaryRow label="This Month" value={v(summary?.this_month_expenses)} icon={BarChart2} iconColor="text-[#007AFF]" />
          <SummaryRow label="Total Expense Records" value={isLoading ? "—" : String(summary?.total_expense_records ?? 0)} icon={Receipt} iconColor="text-[#FF9F0A]" />
        </GlassCard>
      )}
    </div>
  );
}
