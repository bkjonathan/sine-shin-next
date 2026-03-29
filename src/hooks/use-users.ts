"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { toast } from "sonner";
import type { ListParams, ApiSuccess, PaginationMeta } from "@/types";
import type { CreateUserInput, UpdateUserInput } from "@/validations/user.schema";

interface UserListItem {
  id: string;
  username: string;
  role: string;
  createdAt: string;
}

const QUERY_KEY = "users";

export function useUsers(params: ListParams & { enabled?: boolean } = {}) {
  const { enabled = true, ...queryParams } = params;
  return useQuery({
    queryKey: [QUERY_KEY, queryParams],
    queryFn: async () => {
      const { data } = await api.get<ApiSuccess<UserListItem[]> & { meta: PaginationMeta }>("/users", { params: queryParams });
      return data;
    },
    enabled,
  });
}

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => {
      const { data } = await api.get<ApiSuccess<UserListItem>>(`/users/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const { data } = await api.post<ApiSuccess<UserListItem>>("/users", input);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("User created successfully");
    },
    onError: () => {
      toast.error("Failed to create user");
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateUserInput & { id: string }) => {
      const { data } = await api.patch<ApiSuccess<UserListItem>>(`/users/${id}`, input);
      return data.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, id] });
      toast.success("User updated successfully");
    },
    onError: () => {
      toast.error("Failed to update user");
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("User deleted");
    },
    onError: () => {
      toast.error("Failed to delete user");
    },
  });
}
