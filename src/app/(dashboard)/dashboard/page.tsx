"use client";

import { useDashboardStats } from "@/hooks/use-settings";
import { StatsCard } from "@/components/dashboard/stats-card";
import { RecentOrders } from "@/components/dashboard/recent-orders";
import { PageHeader } from "@/components/layout/page-header";
import { GlassButton } from "@/components/ui/glass-button";
import { formatCurrency } from "@/lib/utils";
import { Users, ShoppingCart, TrendingUp, Receipt, Plus } from "lucide-react";
import { useState } from "react";
import { GlassModal } from "@/components/ui/glass-modal";
import { OrderForm } from "@/components/orders/order-form";
import { useCreateOrder } from "@/hooks/use-orders";
import type { CreateOrderInput } from "@/validations/order.schema";

export default function DashboardPage() {
  const { data, isLoading } = useDashboardStats();
  const [creating, setCreating] = useState(false);
  const createOrder = useCreateOrder();

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Shop overview and recent activity"
        actions={
          <GlassButton onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New Order
          </GlassButton>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title="Total Customers"
          value={isLoading ? "—" : (stats?.totalCustomers ?? 0)}
          icon={Users}
          color="blue"
        />
        <StatsCard
          title="Active Orders"
          value={isLoading ? "—" : (stats?.activeOrders ?? 0)}
          icon={ShoppingCart}
          color="amber"
        />
        <StatsCard
          title="Monthly Revenue"
          value={isLoading ? "—" : formatCurrency(stats?.monthlyRevenue ?? 0)}
          icon={TrendingUp}
          color="green"
          subtitle="Completed orders this month"
        />
        <StatsCard
          title="Total Expenses"
          value={isLoading ? "—" : formatCurrency(stats?.totalExpenses ?? 0)}
          icon={Receipt}
          color="red"
        />
      </div>

      <RecentOrders orders={data?.recentOrders ?? []} />

      <GlassModal open={creating} onOpenChange={setCreating} title="New Order" size="lg">
        <OrderForm
          onSubmit={(d: CreateOrderInput) => createOrder.mutate(d, { onSuccess: () => setCreating(false) })}
          isLoading={createOrder.isPending}
          onCancel={() => setCreating(false)}
        />
      </GlassModal>
    </div>
  );
}
