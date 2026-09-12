"use client";

import { useMemo } from "react";
import { useSettings } from "@/hooks/use-settings";
import { shopCurrency } from "@/lib/currency";

/**
 * The shop's currency codes, symbols and default exchange rate. They come from
 * shop settings on the server, not from this browser, so every user formats and
 * converts money the same way (AUDIT.md F-11). Until settings load this returns
 * the shop defaults, so money calculations should use the server-rendered shop
 * row instead (see cargo-detail-client.tsx).
 */
export function useCurrencyPrefs() {
  const { data } = useSettings();
  const prefs = useMemo(() => shopCurrency(data), [data]);
  return { prefs };
}
