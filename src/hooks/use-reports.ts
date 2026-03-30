"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { ReportsData, ReportFilterParams } from "@/types/reports";

interface RawResponse {
  data: ReportsData;
}

function buildQueryString(filters: Partial<ReportFilterParams>): string {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useReportsData(filters: Partial<ReportFilterParams> = {}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", filters],
    queryFn: async () => {
      const qs = buildQueryString(filters);
      const { data } = await api.get<RawResponse>(`/reports${qs}`);
      return data.data;
    },
    staleTime: 60_000,
  });

  return { data: data ?? null, isLoading, error };
}
