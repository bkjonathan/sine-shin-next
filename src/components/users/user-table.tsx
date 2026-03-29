"use client";

import { useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassModal } from "@/components/ui/glass-modal";
import { GlassBadge } from "@/components/ui/glass-badge";
import { UserForm } from "./user-form";
import { useUpdateUser, useDeleteUser } from "@/hooks/use-users";
import { Pencil, Trash2, Shield, UserCog, User } from "lucide-react";
import type { UpdateUserInput } from "@/validations/user.schema";

interface UserListItem {
  id: string;
  username: string;
  role: string;
  createdAt: string;
}

interface UserTableProps {
  users: UserListItem[];
  isLoading?: boolean;
  pageOffset?: number;
  currentUserId?: string;
}

const ROLE_CONFIG: Record<string, { label: string; variant: "default" | "info" | "neutral"; icon: typeof Shield }> = {
  owner: { label: "Owner", variant: "default", icon: Shield },
  manager: { label: "Manager", variant: "info", icon: UserCog },
  staff: { label: "Staff", variant: "neutral", icon: User },
};

export function UserTable({ users, isLoading, pageOffset = 0, currentUserId }: UserTableProps) {
  const [editing, setEditing] = useState<UserListItem | null>(null);
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const columns: ColumnDef<UserListItem>[] = [
    {
      id: "rowNumber",
      header: "#",
      cell: ({ row }) => (
        <span className="text-sm text-t3">{pageOffset + row.index + 1}</span>
      ),
    },
    {
      accessorKey: "username",
      header: "USERNAME",
      cell: ({ row }) => {
        const isSelf = row.original.id === currentUserId;
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent uppercase">
              {row.original.username.charAt(0)}
            </div>
            <div className="min-w-0">
              <span className="block font-medium text-t1 truncate">
                {row.original.username}
              </span>
              {isSelf && (
                <span className="text-[10px] text-accent font-medium">You</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "role",
      header: "ROLE",
      cell: ({ row }) => {
        const config = ROLE_CONFIG[row.original.role] ?? ROLE_CONFIG.staff;
        const Icon = config.icon;
        return (
          <GlassBadge variant={config.variant} className="gap-1">
            <Icon className="h-3 w-3" />
            {config.label}
          </GlassBadge>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "JOINED",
      cell: ({ row }) => (
        <span className="text-sm text-t2">
          {new Date(row.original.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      ),
    },
    {
      id: "actions",
      header: "ACTIONS",
      cell: ({ row }) => {
        const isSelf = row.original.id === currentUserId;
        return (
          <div className="flex items-center gap-1">
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={() => setEditing(row.original)}
              aria-label="Edit user"
            >
              <Pencil className="h-3.5 w-3.5" />
            </GlassButton>
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={() => {
                if (isSelf) return;
                if (confirm(`Delete user "${row.original.username}"?`))
                  deleteUser.mutate(row.original.id);
              }}
              aria-label="Delete user"
              className={isSelf ? "opacity-30 cursor-not-allowed" : "hover:text-danger"}
              disabled={isSelf}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </GlassButton>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <DataTable columns={columns} data={users} isLoading={isLoading} emptyMessage="No users found" />

      <GlassModal open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title="Edit User" size="md">
        {editing && (
          <UserForm
            defaultValues={editing}
            onSubmit={(data) =>
              updateUser.mutate(
                { id: editing.id, ...(data as UpdateUserInput) },
                { onSuccess: () => setEditing(null) }
              )
            }
            isLoading={updateUser.isPending}
            onCancel={() => setEditing(null)}
          />
        )}
      </GlassModal>
    </>
  );
}
