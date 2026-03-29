"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassBadge } from "@/components/ui/glass-badge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useCurrencyPrefs } from "@/hooks/use-currency-prefs";
import type { DashboardOrder } from "@/types/dashboard";

const STATUS_VARIANT: Record<string, "neutral" | "warning" | "info" | "success" | "danger"> = {
  pending:    "neutral",
  confirmed:  "info",
  processing: "warning",
  shipping:   "info",
  arrived:    "info",
  completed:  "success",
  cancelled:  "danger",
};

function CustomerInitials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();

  const colors = [
    "bg-[#007AFF]/20 text-[#007AFF]",
    "bg-[#30D158]/20 text-[#30D158]",
    "bg-[#FF9F0A]/20 text-[#FF9F0A]",
    "bg-[#AF52DE]/20 text-[#AF52DE]",
    "bg-[#FF375F]/20 text-[#FF375F]",
    "bg-[#64D2FF]/20 text-[#64D2FF]",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];

  return (
    <div
      className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
        color
      )}
    >
      {initials}
    </div>
  );
}

interface DashboardRecentOrdersProps {
  orders: DashboardOrder[];
  isLoading: boolean;
}

export function DashboardRecentOrders({ orders, isLoading }: DashboardRecentOrdersProps) {
  const { prefs } = useCurrencyPrefs();
  return (
    <GlassCard padding="none" className="lg:col-span-3">
      <div className="flex items-center justify-between px-5 py-4 border-b border-divide">
        <h3 className="text-sm font-semibold text-t1">Recent Orders</h3>
        <Link
          href="/orders"
          className="text-xs text-accent flex items-center gap-1 hover:opacity-80"
        >
          View All <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="divide-y divide-divide">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5 animate-pulse">
              <div className="w-9 h-9 rounded-full bg-surface shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-surface rounded w-32" />
                <div className="h-2.5 bg-surface rounded w-20" />
              </div>
              <div className="h-3 bg-surface rounded w-16" />
            </div>
          ))
        ) : orders.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-t3">
            No orders for this period
          </p>
        ) : (
          orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-hover transition-colors"
            >
              <CustomerInitials name={order.customerName ?? order.orderId ?? "?"} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-t1 truncate">
                  {order.customerName ?? "—"}
                </p>
                <p className="text-xs text-t3">{order.orderId ?? "—"}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <p className="text-sm font-semibold text-t1">
                  {formatCurrency(order.totalPrice ?? 0, prefs.currencySymbol)}
                </p>
                <div className="flex items-center gap-1.5">
                  {order.status && (
                    <GlassBadge variant={STATUS_VARIANT[order.status] ?? "neutral"}>
                      {order.status}
                    </GlassBadge>
                  )}
                  <span className="text-xs text-t3">
                    {order.orderDate
                      ? formatDate(order.orderDate, "d MMM")
                      : formatDate(order.createdAt, "d MMM")}
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </GlassCard>
  );
}
