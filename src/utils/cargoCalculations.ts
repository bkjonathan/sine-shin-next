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
 * Convert a single payment's amount into the shipment's base currency.
 *
 * Receiver payments are usually made in the foreign (exchange) currency — e.g.
 * MMK — so the amount is divided by the exchange rate (foreign units per base
 * unit) to get back to the base currency. A payment already recorded in the
 * base currency (e.g. THB) is taken at face value: no conversion. Carrier
 * payments are recorded directly in the base currency.
 */
export function convertPaymentToBase(
  payment: Pick<CargoPayment, "partyType" | "amount" | "currency" | "exchangeRate">,
  shipmentExchangeRate: number,
  baseCurrencyCode: string
): number {
  const isBaseCurrency = payment.currency.toUpperCase() === baseCurrencyCode.toUpperCase();
  if (payment.partyType === "receiver" && !isBaseCurrency) {
    const rate = payment.exchangeRate ?? shipmentExchangeRate;
    return rate > 0 ? payment.amount / rate : 0;
  }
  return payment.amount;
}

/**
 * Sum payments per party, converted to base currency using each payment's own
 * exchange-rate snapshot (rates drift day to day, so a shipment-level rate
 * alone isn't accurate for money that already changed hands). Payments recorded
 * directly in the base currency are counted at face value.
 */
export function calculatePaymentTotals(
  payments: Pick<CargoPayment, "partyType" | "amount" | "currency" | "exchangeRate">[],
  shipmentExchangeRate: number,
  baseCurrencyCode: string
) {
  let carrierPaid = 0;
  let receiverPaid = 0;

  for (const payment of payments) {
    const base = convertPaymentToBase(payment, shipmentExchangeRate, baseCurrencyCode);
    if (payment.partyType === "receiver") {
      receiverPaid += base;
    } else {
      carrierPaid += base;
    }
  }

  return { carrierPaid, receiverPaid };
}

export function calculateCargoShipmentSummary(
  items: Pick<CargoItem, "weightKg" | "carrierRatePerKg" | "receiverRatePerKg">[],
  payments: Pick<CargoPayment, "partyType" | "amount" | "currency" | "exchangeRate">[],
  shipmentExchangeRate: number,
  baseCurrencyCode: string
) {
  const totals = calculateCargoShipmentTotals(items);
  const { carrierPaid, receiverPaid } = calculatePaymentTotals(payments, shipmentExchangeRate, baseCurrencyCode);
  return {
    ...totals,
    carrierPaid,
    receiverPaid,
    carrierBalance: totals.carrierOwed - carrierPaid,
    receiverBalance: totals.receiverOwed - receiverPaid,
  };
}
