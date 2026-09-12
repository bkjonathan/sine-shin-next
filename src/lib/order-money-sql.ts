import { sql } from "drizzle-orm";

/**
 * The order money definitions from src/lib/order-money.ts as SQL fragments for
 * queries over `orders` (AUDIT.md F-10). They reference fixed column names,
 * never user input. tests/f10-order-money.test.mjs checks both versions agree.
 */

export const itemsSubtotalSql = sql<number>`coalesce((
  select sum(coalesce(oi.price, 0) * coalesce(oi.product_qty, 1))
  from order_items oi
  where oi.order_id = orders.id and oi.deleted_at is null
), 0)`;

export const serviceFeeAmountSql = sql<number>`(case
  when orders.service_fee_type in ('percent', '%') then ${itemsSubtotalSql} * coalesce(orders.service_fee, 0) / 100
  else coalesce(orders.service_fee, 0)
end)`;

export const orderTotalSql = sql<number>`(${itemsSubtotalSql} + coalesce(orders.shipping_fee, 0)
  + coalesce(orders.delivery_fee, 0) + coalesce(orders.cargo_fee, 0) + ${serviceFeeAmountSql})`;

export const shopIncomeSql = sql<number>`(${serviceFeeAmountSql} + coalesce(orders.product_discount, 0)
  + case when orders.shipping_fee_by_shop then coalesce(orders.shipping_fee, 0) else 0 end
  + case when orders.delivery_fee_by_shop then coalesce(orders.delivery_fee, 0) else 0 end
  + case when orders.cargo_fee_by_shop then coalesce(orders.cargo_fee, 0) else 0 end)`;
