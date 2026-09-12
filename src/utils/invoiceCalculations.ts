import type { Order, OrderItem } from "@/types";
import { lineAmount, itemsSubtotal as sumItems, orderMoney } from "@/lib/order-money";

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function calculateLineAmount(price: number | null, qty: number | null): number {
  return lineAmount(price, qty);
}

export function calculateTotalFees({
  shippingFee,
  deliveryFee,
  cargoFee,
  serviceFeeAmount,
}: {
  shippingFee: number;
  deliveryFee: number;
  cargoFee: number;
  serviceFeeAmount: number;
}): number {
  return shippingFee + deliveryFee + cargoFee + serviceFeeAmount;
}

/**
 * Invoice totals: items subtotal + all fees, converted at the order's exchange
 * rate. Shared by the invoice and the payment-received receipt so both documents
 * always agree, and computed by the shop-wide definitions in src/lib/order-money.ts.
 */
export function calculateOrderTotals(
  order: Pick<
    Order,
    | "shippingFee" | "deliveryFee" | "cargoFee" | "serviceFee" | "serviceFeeType" | "exchangeRate"
    | "productDiscount" | "shippingFeeByShop" | "deliveryFeeByShop" | "cargoFeeByShop"
  >,
  items: (Pick<OrderItem, "price" | "productQty"> & { deletedAt?: Date | string | null })[]
) {
  const { itemsSubtotal, serviceFeeAmount, feesTotal, orderTotal } = orderMoney(order, sumItems(items));
  const totalWithExchange = orderTotal * order.exchangeRate;
  return { itemsSubtotal, serviceFeeAmount, feesTotal, orderTotal, totalWithExchange };
}
