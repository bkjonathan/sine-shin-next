"use client";

import { GlassCard } from "@/components/ui/glass-card";
import { GlassBadge } from "@/components/ui/glass-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { OrderStatus } from "@/types";

interface RecentOrder {
  id: string;
  orderId: string;
  status: string;
  createdAt: string;
}

interface RecentOrdersProps {
  orders: RecentOrder[];
}

const statusVariant: Record<OrderStatus, "neutral" | "warning" | "info" | "success"> = {
  pending:    "neutral",
  ordered:    "warning",
  arrived:    "info",
  shipping:   "warning",
  completed:  "success",
  cancelled:  "neutral",
};

export function RecentOrders({ orders }: RecentOrdersProps) {
  return (
    <GlassCard padding="none">
      <div className="flex items-center justify-between px-6 py-4 border-b border-divide">
        <h3 className="text-sm font-semibold text-t1">Recent Orders</h3>
        <Link href="/orders" className="text-xs text-accent flex items-center gap-1 hover:opacity-80">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="divide-y divide-divide">
        {orders.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-t3">No orders yet</p>
        ) : (
          orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="flex items-center justify-between px-6 py-3.5 hover:bg-surface-hover transition-colors"
            >
              <div className="flex items-center gap-3">
                <GlassBadge variant={statusVariant[order.status as OrderStatus] ?? "neutral"}>
                  {order.status}
                </GlassBadge>
                <div>
                  <p className="text-sm font-medium text-t1">{order.orderId}</p>
                  <p className="text-xs text-t3">{formatDate(order.createdAt)}</p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </GlassCard>
  );
}
