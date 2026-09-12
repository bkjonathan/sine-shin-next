"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { ApiSuccess, PaginationMeta } from "@/types";

export interface AuditLogEntry {
  id: number;
  at: string;
  userId: string | null;
  userRole: string | null;
  clientIp: string | null;
  dbUser: string;
  action: "insert" | "update" | "delete";
  entity: string;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  username: string | null;
}

export function useAuditLog(params: { page: number; entity?: string }) {
  return useQuery({
    queryKey: ["audit-log", params],
    queryFn: async () => {
      const { data } = await api.get<ApiSuccess<AuditLogEntry[]> & { meta: PaginationMeta }>("/audit-log", {
        params: { page: params.page, entity: params.entity },
      });
      return data;
    },
  });
}
