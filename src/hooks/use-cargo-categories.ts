"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { toast } from "sonner";
import type { CargoCategory, ApiSuccess } from "@/types";
import type { CreateCargoCategoryInput, UpdateCargoCategoryInput } from "@/validations/cargo.schema";

const QUERY_KEY = "cargo-categories";

export function useCargoCategories() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data } = await api.get<ApiSuccess<CargoCategory[]>>("/cargo-categories");
      return data.data;
    },
  });
}

export function useCreateCargoCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCargoCategoryInput) => {
      const { data } = await api.post<ApiSuccess<CargoCategory>>("/cargo-categories", input);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Category created");
    },
    onError: () => {
      toast.error("Failed to create category");
    },
  });
}

export function useUpdateCargoCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateCargoCategoryInput & { id: string }) => {
      const { data } = await api.patch<ApiSuccess<CargoCategory>>(`/cargo-categories/${id}`, input);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Category updated");
    },
    onError: () => {
      toast.error("Failed to update category");
    },
  });
}

export function useDeleteCargoCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/cargo-categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Category deleted");
    },
    onError: () => {
      toast.error("Failed to delete category");
    },
  });
}
