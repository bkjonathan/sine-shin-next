import type { CargoItem, CargoPayment, CargoExpense } from "@/types";

export function calculateCargoItemAmounts(item: Pick<CargoItem, "weightKg" | "carrierRatePerKg" | "receiverRatePerKg">) {
  const carrierAmount = item.weightKg * item.carrierRatePerKg;
  const receiverAmount = item.weightKg * item.receiverRatePerKg;
  return { carrierAmount, receiverAmount, profit: receiverAmount - carrierAmount };
}

/**
 * Aggregate weight/cost/revenue/margin across every item in a shipment.
 * `grossProfit` is the spread between what the receiver pays and what the
 * carrier charges per kg — the shipment's freight-forwarding margin, before
 * any additional shipment expenses are deducted.
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
      acc.grossProfit += receiverAmount - carrierAmount;
      return acc;
    },
    { totalWeight: 0, carrierOwed: 0, receiverOwed: 0, grossProfit: 0 }
  );
}

/** Sum of every (non-deleted) expense recorded against a shipment, in base currency. */
export function calculateCargoExpensesTotal(expenses: Pick<CargoExpense, "amount">[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
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

export type ReceiverPaymentStatus = "paid" | "partial" | "unpaid";

export interface ReceiverBalance {
  owed: number;
  paid: number;
  balance: number;
  status: ReceiverPaymentStatus;
}

/**
 * Break the receiver side down per customer so each cargo item can show whether
 * its receiver has settled up. Payments are recorded against a customer, not an
 * individual item, so "is this paid?" is really a per-customer question: total
 * what a customer owes across all their items, then compare it against the
 * receiver payments they've made. Keyed by the resolved customer id (the order's
 * customer for order-based items, or the direct customer id).
 */
export function calculateReceiverBalancesByCustomer(
  items: { receiverCustomerId: string | null; weightKg: number; receiverRatePerKg: number }[],
  payments: Pick<CargoPayment, "partyType" | "customerId" | "amount" | "currency" | "exchangeRate">[],
  shipmentExchangeRate: number,
  baseCurrencyCode: string
): Map<string, ReceiverBalance> {
  const owed = new Map<string, number>();
  for (const it of items) {
    if (!it.receiverCustomerId) continue;
    owed.set(it.receiverCustomerId, (owed.get(it.receiverCustomerId) ?? 0) + it.weightKg * it.receiverRatePerKg);
  }

  const paid = new Map<string, number>();
  for (const p of payments) {
    if (p.partyType !== "receiver" || !p.customerId) continue;
    const base = convertPaymentToBase(p, shipmentExchangeRate, baseCurrencyCode);
    paid.set(p.customerId, (paid.get(p.customerId) ?? 0) + base);
  }

  const result = new Map<string, ReceiverBalance>();
  for (const id of new Set([...owed.keys(), ...paid.keys()])) {
    const o = owed.get(id) ?? 0;
    const pd = paid.get(id) ?? 0;
    const balance = o - pd;
    // 0.01 epsilon so floating-point dust never leaves a settled receiver stuck
    // on "partial" or a paid-in-full one short by a fraction of a satang.
    const status: ReceiverPaymentStatus = pd <= 0.01 ? "unpaid" : balance > 0.01 ? "partial" : "paid";
    result.set(id, { owed: o, paid: pd, balance, status });
  }
  return result;
}

export function calculateCargoShipmentSummary(
  items: Pick<CargoItem, "weightKg" | "carrierRatePerKg" | "receiverRatePerKg">[],
  payments: Pick<CargoPayment, "partyType" | "amount" | "currency" | "exchangeRate">[],
  expenses: Pick<CargoExpense, "amount">[],
  shipmentExchangeRate: number,
  baseCurrencyCode: string
) {
  const totals = calculateCargoShipmentTotals(items);
  const { carrierPaid, receiverPaid } = calculatePaymentTotals(payments, shipmentExchangeRate, baseCurrencyCode);
  const totalExpenses = calculateCargoExpensesTotal(expenses);
  return {
    ...totals,
    totalExpenses,
    // Net profit: freight margin less the shipment's own expenses.
    profit: totals.grossProfit - totalExpenses,
    carrierPaid,
    receiverPaid,
    carrierBalance: totals.carrierOwed - carrierPaid,
    receiverBalance: totals.receiverOwed - receiverPaid,
  };
}
