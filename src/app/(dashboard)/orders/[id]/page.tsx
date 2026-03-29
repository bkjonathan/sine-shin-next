import { notFound } from "next/navigation";
import { db } from "@/db";
import { orders, customers, orderItems } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { OrderDetailClient } from "@/components/orders/order-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  console.log(`[OrderDetail] start id=${id}`);

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), isNull(orders.deletedAt)))
    .limit(1);

  if (!order) notFound();

  // Run items + customer queries in parallel
  const [items, customer] = await Promise.all([
    db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.orderId, id), isNull(orderItems.deletedAt)))
      .then((r) => {
        return r;
      }),
    order.customerId
      ? db
          .select({
            id: customers.id,
            name: customers.name,
            customerId: customers.customerId,
            phone: customers.phone,
            city: customers.city,
            platform: customers.platform,
            address: customers.address,
          })
          .from(customers)
          .where(eq(customers.id, order.customerId))
          .limit(1)
          .then((r) => {
            return r[0] ?? null;
          })
      : Promise.resolve(null),
  ]);

  return <OrderDetailClient order={order} items={items} customer={customer} />;
}
