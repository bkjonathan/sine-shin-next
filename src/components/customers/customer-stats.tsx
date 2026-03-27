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
    <div className="grid grid-cols-3 gap-4">
      <GlassCard padding="sm">
        <p className="text-xs text-white/50">Total Orders</p>
        <p className="text-xl font-bold text-white/90 mt-1">{orderCount}</p>
      </GlassCard>
      <GlassCard padding="sm">
        <p className="text-xs text-white/50">Total Spent</p>
        <p className="text-xl font-bold text-white/90 mt-1">${totalSpent.toFixed(2)}</p>
      </GlassCard>
      <GlassCard padding="sm">
        <p className="text-xs text-white/50">Member Since</p>
        <p className="text-sm font-bold text-white/90 mt-1">{formatDate(customer.createdAt)}</p>
      </GlassCard>
    </div>
  );
}
