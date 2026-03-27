"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { toast } from "sonner";
import type { Order, OrderWithItems, ListParams, ApiSuccess, PaginationMeta } from "@/types";
import type { CreateOrderInput, UpdateOrderInput } from "@/validations/order.schema";

const QUERY_KEY = "orders";

export function useOrders(params: ListParams & { status?: string } = {}) {
  return useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: async () => {
      const { data } = await api.get<ApiSuccess<Order[]> & { meta: PaginationMeta }>("/orders", { params });
      return data;
    },
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => {
      const { data } = await api.get<ApiSuccess<OrderWithItems>>(`/orders/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateOrderInput) => {
      const { data } = await api.post<ApiSuccess<Order>>("/orders", input);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Order created successfully");
    },
    onError: () => {
      toast.error("Failed to create order");
    },
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateOrderInput & { id: string }) => {
      const { data } = await api.patch<ApiSuccess<Order>>(`/orders/${id}`, input);
      return data.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, id] });
      toast.success("Order updated successfully");
    },
    onError: () => {
      toast.error("Failed to update order");
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Order deleted");
    },
    onError: () => {
      toast.error("Failed to delete order");
    },
  });
}

export function useOrderItems(orderId: string | undefined) {
  return useQuery({
    queryKey: ["order-items", orderId],
    queryFn: async () => {
      const { data } = await api.get<ApiSuccess<import("@/types").OrderItem[]>>(`/order-items/${orderId}`);
      return data.data;
    },
    enabled: !!orderId,
  });
}

export function useAddOrderItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, ...item }: import("@/validations/order.schema").OrderItemInput & { orderId: string }) => {
      const { data } = await api.post<ApiSuccess<import("@/types").OrderItem>>(`/order-items/${orderId}`, item);
      return data.data;
    },
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ["order-items", orderId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, orderId] });
      toast.success("Item added");
    },
  });
}

export function useRemoveOrderItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, itemId }: { orderId: string; itemId: string }) => {
      await api.delete(`/order-items/${orderId}`, { data: { itemId } });
    },
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ["order-items", orderId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, orderId] });
      toast.success("Item removed");
    },
  });
}
