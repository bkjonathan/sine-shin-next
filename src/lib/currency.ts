// Shop-wide currency (AUDIT.md F-11). The codes, symbols and default exchange
// rate live in shop_settings, so every browser formats and converts money the
// same way. Every stored amount is in the base currency; only cargo payments
// carry a currency of their own, limited to what the balance math handles.
//
// No imports: shared by route handlers, client components and tests.

export interface CurrencyPrefs {
  currencyCode: string;
  currencySymbol: string;
  exchangeCurrencyCode: string;
  exchangeCurrencySymbol: string;
  /** Pre-fills new orders, shipments and payments; each record keeps its own rate. */
  exchangeRate: number;
}

/** The shop_settings column defaults (drizzle/0010_shop_currency.sql). */
export const CURRENCY_DEFAULTS: CurrencyPrefs = {
  currencyCode: "THB",
  currencySymbol: "฿",
  exchangeCurrencyCode: "MMK",
  exchangeCurrencySymbol: "Ks",
  exchangeRate: 1,
};

interface ShopCurrencyColumns {
  currencyCode?: string;
  currencySymbol?: string;
  exchangeCurrencyCode?: string;
  exchangeCurrencySymbol?: string;
  defaultExchangeRate?: number;
}

/** Currency prefs from a shop_settings row, or the defaults when there is no row (yet). */
export function shopCurrency(shop: ShopCurrencyColumns | null | undefined): CurrencyPrefs {
  return {
    currencyCode: shop?.currencyCode ?? CURRENCY_DEFAULTS.currencyCode,
    currencySymbol: shop?.currencySymbol ?? CURRENCY_DEFAULTS.currencySymbol,
    exchangeCurrencyCode: shop?.exchangeCurrencyCode ?? CURRENCY_DEFAULTS.exchangeCurrencyCode,
    exchangeCurrencySymbol: shop?.exchangeCurrencySymbol ?? CURRENCY_DEFAULTS.exchangeCurrencySymbol,
    exchangeRate: shop?.defaultExchangeRate ?? CURRENCY_DEFAULTS.exchangeRate,
  };
}

/**
 * Why a cargo payment's currency can't be accepted, or null if it can.
 * Balances divide a receiver payment by the exchange rate unless it is in the
 * base currency, and count carrier payments at face value — so receivers may
 * pay in the base or exchange currency, carriers in the base currency only.
 */
export function paymentCurrencyError(
  partyType: "carrier" | "receiver",
  currency: string,
  shop: Pick<CurrencyPrefs, "currencyCode" | "exchangeCurrencyCode">
): string | null {
  const code = currency.trim().toUpperCase();
  if (code === shop.currencyCode) return null;
  if (partyType === "carrier") return `Carrier payments must be in ${shop.currencyCode}`;
  if (code === shop.exchangeCurrencyCode) return null;
  return `Receiver payments must be in ${shop.currencyCode} or ${shop.exchangeCurrencyCode}`;
}
