"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import { useMemo } from "react";
import type { DashboardOrder, AccountSummary } from "@/types/dashboard";
import type { Expense } from "@/types";
import { calculateAccountSummary } from "@/utils/calculations";

interface AccountResponse {
  data: {
    orders:   DashboardOrder[];
    expenses: Expense[];
  };
}

export function useAccountSummary() {
  const { data: raw, isLoading, error } = useQuery({
    queryKey: ["account-summary"],
    queryFn: async () => {
      const { data } = await api.get<AccountResponse>("/account");
      return data.data;
    },
  });

  const summary = useMemo<AccountSummary | null>(() => {
    if (!raw) return null;
    return calculateAccountSummary(raw.orders, raw.expenses);
  }, [raw]);

  return {
    summary,
    orders:   raw?.orders   ?? [],
    expenses: raw?.expenses ?? [],
    isLoading,
    error,
  };
}
