import { notFound } from "next/navigation";
import { db } from "@/db";
import { orders, customers, orderItems } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassBadge } from "@/components/ui/glass-badge";
import { PageHeader } from "@/components/layout/page-header";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderItemsSection } from "@/components/orders/order-items-section";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), isNull(orders.deletedAt)))
    .limit(1);

  if (!order) notFound();

  const items = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.orderId, id), isNull(orderItems.deletedAt)));

  const customer = order.customerId
    ? await db
        .select({ id: customers.id, name: customers.name, customerId: customers.customerId })
        .from(customers)
        .where(eq(customers.id, order.customerId))
        .limit(1)
        .then((r) => r[0] ?? null)
    : null;

  const fees = order.shippingFee + order.deliveryFee + order.cargoFee + order.serviceFee;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/orders" className="text-white/40 hover:text-white/70 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader
          title={order.orderId}
          description={`Created ${formatDate(order.createdAt)}`}
          actions={<OrderStatusBadge status={order.status} />}
          className="mb-0 flex-1"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <GlassCard>
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Order Items</h3>
            <OrderItemsSection orderId={id} items={items} />
          </GlassCard>

          {/* Fee breakdown */}
          <GlassCard>
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Fee Breakdown</h3>
            <dl className="space-y-2">
              {[
                ["× Exchange Rate", order.exchangeRate.toFixed(4)],
                ["Shipping Fee", formatCurrency(order.shippingFee)],
                ["Delivery Fee", formatCurrency(order.deliveryFee)],
                ["Cargo Fee", formatCurrency(order.cargoFee)],
                ["Service Fee", formatCurrency(order.serviceFee)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <dt className="text-white/50">{label}</dt>
                  <dd className="text-white/80 font-medium">{value}</dd>
                </div>
              ))}
              <div className="border-t border-white/10 pt-2 flex justify-between text-base font-semibold">
                <dt className="text-white/80">Fees Total</dt>
                <dd className="text-white/90">{formatCurrency(fees)}</dd>
              </div>
            </dl>
          </GlassCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <GlassCard>
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Customer</h3>
            {customer ? (
              <div>
                <Link href={`/customers/${customer.id}`} className="font-medium text-white/90 hover:text-[#007AFF] transition-colors">
                  {customer.name}
                </Link>
                <p className="text-xs text-white/40 mt-0.5 font-mono">{customer.customerId}</p>
              </div>
            ) : (
              <p className="text-sm text-white/40">No customer linked</p>
            )}
          </GlassCard>

        </div>
      </div>
    </div>
  );
}
