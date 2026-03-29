"use client";

import { useState, useEffect } from "react";

export interface CurrencyPrefs {
  currencyCode:           string;
  currencySymbol:         string;
  exchangeCurrencyCode:   string;
  exchangeCurrencySymbol: string;
  exchangeRate:           number;
}

export const CURRENCY_DEFAULTS: CurrencyPrefs = {
  currencyCode:           "USD",
  currencySymbol:         "$",
  exchangeCurrencyCode:   "MMK",
  exchangeCurrencySymbol: "Ks",
  exchangeRate:           1,
};

export function useCurrencyPrefs() {
  const [prefs, setPrefs] = useState<CurrencyPrefs>(CURRENCY_DEFAULTS);

  useEffect(() => {
    const stored = localStorage.getItem("currency-prefs");
    if (stored) setPrefs(JSON.parse(stored));
  }, []);

  function update(next: CurrencyPrefs) {
    setPrefs(next);
    localStorage.setItem("currency-prefs", JSON.stringify(next));
  }

  return { prefs, update };
}
