"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { toast } from "sonner";
import type {
  CargoShipment,
  CargoShipmentListItem,
  CargoShipmentWithDetails,
  CargoPaymentWithCustomer,
  CargoExpense,
  ListParams,
  ApiSuccess,
  PaginationMeta,
} from "@/types";
import type {
  CreateCargoShipmentInput,
  UpdateCargoShipmentInput,
  CargoItemInput,
  UpdateCargoItemInput,
  CargoPaymentInput,
  CargoExpenseInput,
} from "@/validations/cargo.schema";

const QUERY_KEY = "cargo-shipments";

export function useCargoShipments(params: ListParams & { status?: string } = {}) {
  return useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: async () => {
      const { data } = await api.get<ApiSuccess<CargoShipmentListItem[]> & { meta: PaginationMeta }>("/cargo-shipments", { params });
      return data;
    },
  });
}

export function useCargoShipment(id: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => {
      const { data } = await api.get<ApiSuccess<CargoShipmentWithDetails>>(`/cargo-shipments/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateCargoShipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCargoShipmentInput) => {
      const { data } = await api.post<ApiSuccess<CargoShipment>>("/cargo-shipments", input);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Cargo shipment created");
    },
    onError: () => {
      toast.error("Failed to create cargo shipment");
    },
  });
}

export function useUpdateCargoShipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateCargoShipmentInput & { id: string }) => {
      const { data } = await api.patch<ApiSuccess<CargoShipment>>(`/cargo-shipments/${id}`, input);
      return data.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, id] });
      toast.success("Cargo shipment updated");
    },
    onError: () => {
      toast.error("Failed to update cargo shipment");
    },
  });
}

export function useDeleteCargoShipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/cargo-shipments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Cargo shipment deleted");
    },
    onError: () => {
      toast.error("Failed to delete cargo shipment");
    },
  });
}

export function useAddCargoItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ cargoShipmentId, ...item }: CargoItemInput & { cargoShipmentId: string }) => {
      const { data } = await api.post(`/cargo-items/${cargoShipmentId}`, item);
      return data.data;
    },
    onSuccess: (_, { cargoShipmentId }) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, cargoShipmentId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Item added");
    },
    onError: () => {
      toast.error("Failed to add item");
    },
  });
}

type UpdateCargoItemBag =
  | { itemId: string; bagLabel: string | null }
  | { fromBagLabel: string; toBagLabel: string | null };

export function useUpdateCargoItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ cargoShipmentId, ...body }: UpdateCargoItemBag & { cargoShipmentId: string }) => {
      const { data } = await api.patch(`/cargo-items/${cargoShipmentId}`, body);
      return data.data;
    },
    onSuccess: (_, { cargoShipmentId }) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, cargoShipmentId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: () => {
      toast.error("Failed to update bag");
    },
  });
}

/** Edits an existing item's category, bag, weight, rates and note. */
export function useEditCargoItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ cargoShipmentId, ...body }: UpdateCargoItemInput & { cargoShipmentId: string; itemId: string }) => {
      const { data } = await api.patch(`/cargo-items/${cargoShipmentId}`, body);
      return data.data;
    },
    onSuccess: (_, { cargoShipmentId }) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, cargoShipmentId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Item updated");
    },
    onError: () => {
      toast.error("Failed to update item");
    },
  });
}

export function useRemoveCargoItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ cargoShipmentId, itemId }: { cargoShipmentId: string; itemId: string }) => {
      await api.delete(`/cargo-items/${cargoShipmentId}`, { data: { itemId } });
    },
    onSuccess: (_, { cargoShipmentId }) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, cargoShipmentId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Item removed");
    },
    onError: () => {
      toast.error("Failed to remove item");
    },
  });
}

export function useCargoPayments(cargoShipmentId: string | undefined) {
  return useQuery({
    queryKey: ["cargo-payments", cargoShipmentId],
    queryFn: async () => {
      const { data } = await api.get<ApiSuccess<CargoPaymentWithCustomer[]>>(`/cargo-payments/${cargoShipmentId}`);
      return data.data;
    },
    enabled: !!cargoShipmentId,
  });
}

export function useAddCargoPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ cargoShipmentId, ...payment }: CargoPaymentInput & { cargoShipmentId: string }) => {
      const { data } = await api.post(`/cargo-payments/${cargoShipmentId}`, payment);
      return data.data;
    },
    onSuccess: (_, { cargoShipmentId }) => {
      queryClient.invalidateQueries({ queryKey: ["cargo-payments", cargoShipmentId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, cargoShipmentId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Payment recorded");
    },
    onError: () => {
      toast.error("Failed to record payment");
    },
  });
}

export function useRemoveCargoPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ cargoShipmentId, paymentId }: { cargoShipmentId: string; paymentId: string }) => {
      await api.delete(`/cargo-payments/${cargoShipmentId}`, { data: { paymentId } });
    },
    onSuccess: (_, { cargoShipmentId }) => {
      queryClient.invalidateQueries({ queryKey: ["cargo-payments", cargoShipmentId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, cargoShipmentId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Payment removed");
    },
    onError: () => {
      toast.error("Failed to remove payment");
    },
  });
}

export function useCargoExpenses(cargoShipmentId: string | undefined) {
  return useQuery({
    queryKey: ["cargo-expenses", cargoShipmentId],
    queryFn: async () => {
      const { data } = await api.get<ApiSuccess<CargoExpense[]>>(`/cargo-expenses/${cargoShipmentId}`);
      return data.data;
    },
    enabled: !!cargoShipmentId,
  });
}

export function useAddCargoExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ cargoShipmentId, ...expense }: CargoExpenseInput & { cargoShipmentId: string }) => {
      const { data } = await api.post(`/cargo-expenses/${cargoShipmentId}`, expense);
      return data.data;
    },
    onSuccess: (_, { cargoShipmentId }) => {
      queryClient.invalidateQueries({ queryKey: ["cargo-expenses", cargoShipmentId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, cargoShipmentId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Expense added");
    },
    onError: () => {
      toast.error("Failed to add expense");
    },
  });
}

export function useRemoveCargoExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ cargoShipmentId, expenseId }: { cargoShipmentId: string; expenseId: string }) => {
      await api.delete(`/cargo-expenses/${cargoShipmentId}`, { data: { expenseId } });
    },
    onSuccess: (_, { cargoShipmentId }) => {
      queryClient.invalidateQueries({ queryKey: ["cargo-expenses", cargoShipmentId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, cargoShipmentId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Expense removed");
    },
    onError: () => {
      toast.error("Failed to remove expense");
    },
  });
}
