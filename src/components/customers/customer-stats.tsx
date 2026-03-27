import { GlassCard } from "@/components/ui/glass-card";
import { formatDate } from "@/lib/utils";
import type { Customer } from "@/types";

interface CustomerStatsProps {
  customer: Customer;
  orderCount: number;
  totalSpent: number;
}

export function CustomerStats({ customer, orderCount, totalSpent }: CustomerStatsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <GlassCard padding="sm">
        <p className="text-xs text-t3">Total Orders</p>
        <p className="mt-1 text-xl font-bold text-t1">{orderCount}</p>
      </GlassCard>
      <GlassCard padding="sm">
        <p className="text-xs text-t3">Total Spent</p>
        <p className="mt-1 text-xl font-bold text-t1">${totalSpent.toFixed(2)}</p>
      </GlassCard>
      <GlassCard padding="sm">
        <p className="text-xs text-t3">Member Since</p>
        <p className="mt-1 text-sm font-bold text-t1">{formatDate(customer.createdAt)}</p>
      </GlassCard>
    </div>
  );
}
