"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { DashboardCargoData } from "@/types/dashboard";

interface CargoParams {
  date_from?: string | null;
  date_to?: string | null;
}

export function useDashboardCargo(params: CargoParams = {}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-cargo", params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params.date_from) qs.set("dateFrom", params.date_from);
      if (params.date_to)   qs.set("dateTo",   params.date_to);
      const q = qs.toString();
      const { data } = await api.get<{ data: DashboardCargoData }>(
        `/dashboard/cargo${q ? `?${q}` : ""}`
      );
      return data.data;
    },
  });

  return { cargo: data ?? null, isLoading, error };
}
