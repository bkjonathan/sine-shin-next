/**
 * The shop's money definitions for orders, in one place (AUDIT.md F-10).
 * Agreed with the owner on 2026-09-11. src/lib/order-money-sql.ts implements
 * the same formulas in SQL; tests/f10-order-money.test.mjs checks they agree.
 *
 * - Items subtotal: price × quantity over non-deleted items. An item with no
 *   quantity counts as 1; an item with no price counts as 0.
 * - Service fee: a "percent" (or legacy "%") fee is that percentage of the
 *   items subtotal; otherwise it is an amount.
 * - Order total: items subtotal + shipping + delivery + cargo + service fee.
 *   The customer is charged every fee, including fees ticked "Shop" and a cargo
 *   fee ticked "Excluded". Revenue is the sum of order totals.
 * - Shop income: service fee + purchase discount + each fee ticked "Shop".
 * - Profit: shop income minus the expenses dated in the same period.
 * - "Excluded" only removes a cargo fee from the cargo statistics.
 *
 * Amounts are still plain numbers (double precision) until F-09.
 */

export interface OrderFees {
  shippingFee: number | null;
  deliveryFee: number | null;
  cargoFee: number | null;
  serviceFee: number | null;
  serviceFeeType: string | null;
  productDiscount: number | null;
  shippingFeeByShop: boolean | null;
  deliveryFeeByShop: boolean | null;
  cargoFeeByShop: boolean | null;
}

export interface OrderMoney {
  itemsSubtotal: number;
  serviceFeeAmount: number;
  feesTotal: number;
  orderTotal: number;
  shopIncome: number;
}

export interface ItemAmount {
  price: number | null;
  productQty: number | null;
  deletedAt?: Date | string | null;
}

export function isPercentServiceFee(type: string | null | undefined): boolean {
  return type === "percent" || type === "%";
}

export function lineAmount(price: number | null, qty: number | null): number {
  return (price ?? 0) * (qty ?? 1);
}

export function itemsSubtotal(items: ItemAmount[]): number {
  return items.reduce((sum, i) => (i.deletedAt ? sum : sum + lineAmount(i.price, i.productQty)), 0);
}

export function orderMoney(order: OrderFees, subtotal: number): OrderMoney {
  const shipping = order.shippingFee ?? 0;
  const delivery = order.deliveryFee ?? 0;
  const cargo = order.cargoFee ?? 0;
  const fee = order.serviceFee ?? 0;
  const serviceFeeAmount = isPercentServiceFee(order.serviceFeeType) ? (subtotal * fee) / 100 : fee;
  // Same operation order as order-money-sql.ts, so both give identical floats.
  const orderTotal = subtotal + shipping + delivery + cargo + serviceFeeAmount;
  const shopIncome =
    serviceFeeAmount +
    (order.productDiscount ?? 0) +
    (order.shippingFeeByShop ? shipping : 0) +
    (order.deliveryFeeByShop ? delivery : 0) +
    (order.cargoFeeByShop ? cargo : 0);
  const feesTotal = shipping + delivery + cargo + serviceFeeAmount;
  return { itemsSubtotal: subtotal, serviceFeeAmount, feesTotal, orderTotal, shopIncome };
}

/** Revenue, shop income and profit for a set of orders and that period's expenses. */
export function summarizeOrders(orders: OrderMoney[], periodExpenses: number) {
  const revenue = orders.reduce((sum, o) => sum + o.orderTotal, 0);
  const shopIncome = orders.reduce((sum, o) => sum + o.shopIncome, 0);
  return { revenue, shopIncome, expenses: periodExpenses, profit: shopIncome - periodExpenses };
}
