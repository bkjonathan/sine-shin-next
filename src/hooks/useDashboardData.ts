"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import { useMemo } from "react";
import type { DashboardOrder, DashboardFilterParams, DashboardStats } from "@/types/dashboard";
import { calculateDashboardStats } from "@/utils/calculations";

interface RawResponse {
  data: DashboardOrder[];
}

function buildQueryString(filters: Partial<DashboardFilterParams>): string {
  const params = new URLSearchParams();
  if (filters.date_from)  params.set("dateFrom",   filters.date_from);
  if (filters.date_to)    params.set("dateTo",     filters.date_to);
  if (filters.date_field) params.set("dateField",  filters.date_field);
  if (filters.status)     params.set("status",     filters.status);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useDashboardData(filters: Partial<DashboardFilterParams> = {}) {
  const { data: raw, isLoading, error } = useQuery({
    queryKey: ["dashboard-orders", filters],
    queryFn: async () => {
      const qs = buildQueryString(filters);
      const { data } = await api.get<RawResponse>(`/dashboard/orders${qs}`);
      return data.data;
    },
  });

  const stats = useMemo<DashboardStats | null>(() => {
    if (!raw) return null;
    return calculateDashboardStats(raw, []);
  }, [raw]);

  return { orders: raw ?? [], stats, isLoading, error };
}
