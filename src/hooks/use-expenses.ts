"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { toast } from "sonner";
import type { Expense, ExpenseListParams, ApiSuccess, PaginationMeta } from "@/types";
import type { CreateExpenseInput, UpdateExpenseInput } from "@/validations/expense.schema";

const QUERY_KEY = "expenses";

export function useExpenses(params: ExpenseListParams = {}) {
  return useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: async () => {
      const { data } = await api.get<ApiSuccess<Expense[]> & { meta: PaginationMeta }>("/expenses", { params });
      return data;
    },
  });
}

export function useExpense(id: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => {
      const { data } = await api.get<ApiSuccess<Expense>>(`/expenses/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateExpenseInput) => {
      const { data } = await api.post<ApiSuccess<Expense>>("/expenses", input);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Expense recorded");
    },
    onError: () => {
      toast.error("Failed to record expense");
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateExpenseInput & { id: string }) => {
      const { data } = await api.patch<ApiSuccess<Expense>>(`/expenses/${id}`, input);
      return data.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, id] });
      toast.success("Expense updated");
    },
    onError: () => {
      toast.error("Failed to update expense");
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Expense deleted");
    },
    onError: () => {
      toast.error("Failed to delete expense");
    },
  });
}
