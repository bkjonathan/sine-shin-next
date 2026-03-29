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
