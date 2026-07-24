import type { Order, OrderItem } from "@/types";

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function calculateLineAmount(price: number | null, qty: number | null): number {
  return (price ?? 0) * (qty ?? 1);
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
 * Same total-calculation logic used for the invoice: items subtotal + all fees,
 * converted at the order's exchange rate. Shared by the invoice and the
 * payment-received receipt so both documents always agree on the total.
 */
export function calculateOrderTotals(
  order: Pick<Order, "shippingFee" | "deliveryFee" | "cargoFee" | "serviceFee" | "serviceFeeType" | "exchangeRate">,
  items: Pick<OrderItem, "price" | "productQty">[]
) {
  const itemsSubtotal = items.reduce((s, i) => s + calculateLineAmount(i.price, i.productQty), 0);
  const isPercentFee = order.serviceFeeType === "%" || order.serviceFeeType === "percent";
  const serviceFeeAmount = isPercentFee ? itemsSubtotal * (order.serviceFee / 100) : order.serviceFee;
  const feesTotal = calculateTotalFees({
    shippingFee: order.shippingFee,
    deliveryFee: order.deliveryFee,
    cargoFee: order.cargoFee,
    serviceFeeAmount,
  });
  const orderTotal = itemsSubtotal + feesTotal;
  const totalWithExchange = orderTotal * order.exchangeRate;
  return { itemsSubtotal, serviceFeeAmount, feesTotal, orderTotal, totalWithExchange };
}
