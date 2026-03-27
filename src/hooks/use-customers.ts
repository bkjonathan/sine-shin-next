"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { toast } from "sonner";
import type { Customer, ListParams, ApiSuccess, PaginationMeta } from "@/types";
import type { CreateCustomerInput, UpdateCustomerInput } from "@/validations/customer.schema";

const QUERY_KEY = "customers";

export function useCustomers(params: ListParams = {}) {
  return useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: async () => {
      const { data } = await api.get<ApiSuccess<Customer[]> & { meta: PaginationMeta }>("/customers", { params });
      return data;
    },
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => {
      const { data } = await api.get<ApiSuccess<Customer>>(`/customers/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCustomerInput) => {
      const { data } = await api.post<ApiSuccess<Customer>>("/customers", input);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Customer created successfully");
    },
    onError: () => {
      toast.error("Failed to create customer");
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateCustomerInput & { id: string }) => {
      const { data } = await api.patch<ApiSuccess<Customer>>(`/customers/${id}`, input);
      return data.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, id] });
      toast.success("Customer updated successfully");
    },
    onError: () => {
      toast.error("Failed to update customer");
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Customer deleted");
    },
    onError: () => {
      toast.error("Failed to delete customer");
    },
  });
}
