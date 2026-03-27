"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { toast } from "sonner";
import type { ShopSettings, ApiSuccess } from "@/types";
import type { UpdateSettingsInput, ChangePasswordInput } from "@/validations/settings.schema";

const QUERY_KEY = "settings";

export function useSettings() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data } = await api.get<ApiSuccess<ShopSettings>>("/settings");
      return data.data;
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateSettingsInput) => {
      const { data } = await api.patch<ApiSuccess<ShopSettings>>("/settings", input);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Settings saved");
    },
    onError: () => {
      toast.error("Failed to save settings");
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: ChangePasswordInput) => {
      await api.patch("/settings", input);
    },
    onSuccess: () => {
      toast.success("Password changed successfully");
    },
    onError: () => {
      toast.error("Failed to change password");
    },
  });
}

export interface DashboardFilters {
  dateFrom?: string;
  dateTo?: string;
  dateField?: string;
  status?: string;
}

export interface DashboardData {
  financial: {
    totalRevenue: number;
    netRevenue: number;
    totalProfit: number;
    avgOrderValue: number;
  };
  operations: {
    totalOrders: number;
    totalCustomers: number;
    totalCargoFee: number;
    paidCargoFee: number;
    unpaidCargoFee: number;
    excludedCargoFee: number;
    cargoCollectionRate: number;
  };
  recentActivity: Array<{
    id: string;
    orderId: string;
    status: string;
    total: number;
    createdAt: string;
    customerName: string | null;
    customerDisplayId: string | null;
  }>;
}

export function useDashboardStats(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: ["dashboard", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.dateFrom)  params.set("dateFrom",  filters.dateFrom);
      if (filters.dateTo)    params.set("dateTo",    filters.dateTo);
      if (filters.dateField) params.set("dateField", filters.dateField);
      if (filters.status)    params.set("status",    filters.status);
      const qs = params.toString();
      const { data } = await api.get<ApiSuccess<DashboardData>>(`/dashboard${qs ? `?${qs}` : ""}`);
      return data.data;
    },
  });
}
