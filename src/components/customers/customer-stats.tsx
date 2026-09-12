import { GlassCard } from "@/components/ui/glass-card";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Customer } from "@/types";

interface CustomerStatsProps {
  customer: Customer;
  orderCount: number;
  totalSpent: number;
  currencySymbol: string;
}

export function CustomerStats({ customer, orderCount, totalSpent, currencySymbol }: CustomerStatsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <GlassCard padding="sm">
        <p className="text-xs text-t3">Total Orders</p>
        <p className="mt-1 text-xl font-bold text-t1">{orderCount}</p>
      </GlassCard>
      <GlassCard padding="sm">
        <p className="text-xs text-t3">Total Spent</p>
        <p className="mt-1 text-xl font-bold text-t1">{formatCurrency(totalSpent, currencySymbol)}</p>
      </GlassCard>
      <GlassCard padding="sm">
        <p className="text-xs text-t3">Member Since</p>
        <p className="mt-1 text-sm font-bold text-t1">{formatDate(customer.createdAt)}</p>
      </GlassCard>
    </div>
  );
}
