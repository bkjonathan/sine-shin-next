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

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const { data } = await api.get<ApiSuccess<{
        stats: {
          totalCustomers: number;
          activeOrders: number;
          monthlyRevenue: number;
          totalExpenses: number;
        };
        recentOrders: Array<{
          id: string;
          orderId: string;
          status: string;
          total: number;
          createdAt: string;
          customerId: string | null;
        }>;
      }>>("/dashboard");
      return data.data;
    },
  });
}
