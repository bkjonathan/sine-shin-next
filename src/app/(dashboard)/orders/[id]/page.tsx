import { notFound } from "next/navigation";
import { db } from "@/db";
import { orders, customers, orderItems } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { GlassCard } from "@/components/ui/glass-card";
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
        <Link href="/orders" className="text-t3 transition-colors hover:text-t1">
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
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-t3">Order Items</h3>
            <OrderItemsSection orderId={id} items={items} />
          </GlassCard>

          {/* Fee breakdown */}
          <GlassCard>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-t3">Fee Breakdown</h3>
            <dl className="space-y-2">
              {[
                ["× Exchange Rate", order.exchangeRate.toFixed(4)],
                ["Shipping Fee", formatCurrency(order.shippingFee)],
                ["Delivery Fee", formatCurrency(order.deliveryFee)],
                ["Cargo Fee", formatCurrency(order.cargoFee)],
                ["Service Fee", formatCurrency(order.serviceFee)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <dt className="text-t3">{label}</dt>
                  <dd className="font-medium text-t1">{value}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-divide pt-2 text-base font-semibold">
                <dt className="text-t1">Fees Total</dt>
                <dd className="text-t1">{formatCurrency(fees)}</dd>
              </div>
            </dl>
          </GlassCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <GlassCard>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-t3">Customer</h3>
            {customer ? (
              <div>
                <Link href={`/customers/${customer.id}`} className="font-medium text-t1 transition-colors hover:text-accent">
                  {customer.name}
                </Link>
                <p className="mt-0.5 font-mono text-xs text-t3">{customer.customerId}</p>
              </div>
            ) : (
              <p className="text-sm text-t3">No customer linked</p>
            )}
          </GlassCard>

        </div>
      </div>
    </div>
  );
}
