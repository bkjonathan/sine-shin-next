import { notFound } from "next/navigation";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { eq, isNull, and, sql } from "drizzle-orm";
import { GlassCard } from "@/components/ui/glass-card";
import { PageHeader } from "@/components/layout/page-header";
import { CustomerStats } from "@/components/customers/customer-stats";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;

  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), isNull(customers.deletedAt)))
    .limit(1);

  if (!customer) notFound();

  const customerOrders = await db
    .select()
    .from(orders)
    .where(and(eq(orders.customerId, id), isNull(orders.deletedAt)))
    .orderBy(orders.createdAt);

  const totalSpent = customerOrders
    .filter((o) => o.status === "completed")
    .reduce((s, o) => s + o.shippingFee + o.deliveryFee + o.cargoFee + o.serviceFee, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.name}
        description={customer.customerId}
      />

      <CustomerStats customer={customer} orderCount={customerOrders.length} totalSpent={totalSpent} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile */}
        <GlassCard>
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Profile</h3>
          <dl className="space-y-3">
            {[
              ["ID", customer.customerId],
              ["Phone", customer.phone ?? "—"],
              ["City", customer.city ?? "—"],
              ["Platform", customer.platform ?? "—"],
              ["Social Media", customer.socialMediaUrl ?? "—"],
              ["Address", customer.address ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-4">
                <dt className="w-24 shrink-0 text-xs text-white/40 pt-0.5">{label}</dt>
                <dd className="text-sm text-white/80 break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </GlassCard>

        {/* Orders */}
        <GlassCard padding="none">
          <div className="px-6 py-4 border-b border-white/10">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Order History</h3>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {customerOrders.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-white/40">No orders yet</p>
            ) : (
              customerOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex items-center justify-between px-6 py-3.5 hover:bg-white/[0.04] transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-white/80">{order.orderId}</p>
                    <p className="text-xs text-white/40">{formatDate(order.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <OrderStatusBadge status={order.status} />
                    <span className="text-sm font-semibold text-white/80">{formatCurrency(order.shippingFee + order.deliveryFee + order.cargoFee + order.serviceFee)}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
