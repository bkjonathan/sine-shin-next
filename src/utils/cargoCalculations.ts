import type { CargoItem, CargoPayment } from "@/types";

export function calculateCargoItemAmounts(item: Pick<CargoItem, "weightKg" | "carrierRatePerKg" | "receiverRatePerKg">) {
  const carrierAmount = item.weightKg * item.carrierRatePerKg;
  const receiverAmount = item.weightKg * item.receiverRatePerKg;
  return { carrierAmount, receiverAmount, profit: receiverAmount - carrierAmount };
}

/**
 * Aggregate weight/cost/revenue/profit across every item in a shipment.
 * Profit is the spread between what the receiver pays and what the carrier
 * charges per kg — the shipment's freight-forwarding margin.
 */
export function calculateCargoShipmentTotals(
  items: Pick<CargoItem, "weightKg" | "carrierRatePerKg" | "receiverRatePerKg">[]
) {
  return items.reduce(
    (acc, item) => {
      const { carrierAmount, receiverAmount } = calculateCargoItemAmounts(item);
      acc.totalWeight += item.weightKg;
      acc.carrierOwed += carrierAmount;
      acc.receiverOwed += receiverAmount;
      acc.profit += receiverAmount - carrierAmount;
      return acc;
    },
    { totalWeight: 0, carrierOwed: 0, receiverOwed: 0, profit: 0 }
  );
}

/**
 * Sum payments per party, converted to base currency using each payment's own
 * exchange-rate snapshot (rates drift day to day, so a shipment-level rate
 * alone isn't accurate for money that already changed hands).
 */
export function calculatePaymentTotals(
  payments: Pick<CargoPayment, "partyType" | "amount" | "exchangeRate">[],
  shipmentExchangeRate: number
) {
  let carrierPaid = 0;
  let receiverPaid = 0;

  for (const payment of payments) {
    const rate = payment.exchangeRate ?? shipmentExchangeRate;
    if (payment.partyType === "receiver") {
      // Receiver pays in MMK; convert back to base currency.
      receiverPaid += rate > 0 ? payment.amount / rate : 0;
    } else {
      carrierPaid += payment.amount;
    }
  }

  return { carrierPaid, receiverPaid };
}

export function calculateCargoShipmentSummary(
  items: Pick<CargoItem, "weightKg" | "carrierRatePerKg" | "receiverRatePerKg">[],
  payments: Pick<CargoPayment, "partyType" | "amount" | "exchangeRate">[],
  shipmentExchangeRate: number
) {
  const totals = calculateCargoShipmentTotals(items);
  const { carrierPaid, receiverPaid } = calculatePaymentTotals(payments, shipmentExchangeRate);
  return {
    ...totals,
    carrierPaid,
    receiverPaid,
    carrierBalance: totals.carrierOwed - carrierPaid,
    receiverBalance: totals.receiverOwed - receiverPaid,
  };
}
