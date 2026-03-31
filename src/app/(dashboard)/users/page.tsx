"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useUsers, useCreateUser } from "@/hooks/use-users";
import { UserTable } from "@/components/users/user-table";
import { PageHeader } from "@/components/layout/page-header";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassSelect } from "@/components/ui/glass-select";
import { GlassModal } from "@/components/ui/glass-modal";
import { GlassCard } from "@/components/ui/glass-card";
import { UserForm } from "@/components/users/user-form";
import {
  Plus,
  ArrowUp,
  ArrowDown,
  Shield,
  UserCog,
  User,
  Users,
  LayoutGrid,
  List,
  Pencil,
  Trash2,
} from "lucide-react";
import type { CreateUserInput, UpdateUserInput } from "@/validations/user.schema";
import { useUpdateUser, useDeleteUser } from "@/hooks/use-users";
import { GlassBadge } from "@/components/ui/glass-badge";
import { cn } from "@/lib/utils";

type SortOrder = "asc" | "desc";

const SORT_OPTIONS = [
  { value: "createdAt", label: "Sort by Date" },
  { value: "username", label: "Sort by Username" },
  { value: "role", label: "Sort by Role" },
];

const PER_PAGE_OPTIONS = [
  { value: "10", label: "10" },
  { value: "20", label: "20" },
  { value: "50", label: "50" },
];

export default function UsersPage() {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [view, setView] = useState<"table" | "grid">(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "grid" : "table"
  );
  const [creating, setCreating] = useState(false);
  const createUser = useCreateUser();

  const { data, isLoading } = useUsers({ page, search, limit, sort, order });

  const total = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.totalPages ?? 1;
  const pageOffset = (page - 1) * limit;
  const allUsers = data?.data ?? [];

  // Role counts
  const ownerCount = allUsers.filter((u) => u.role === "owner").length;
  const managerCount = allUsers.filter((u) => u.role === "manager").length;
  const staffCount = allUsers.filter((u) => u.role === "staff").length;

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };
  const handleSort = (val: string) => {
    setSort(val);
    setPage(1);
  };
  const handleLimit = (val: string) => {
    setLimit(Number(val));
    setPage(1);
  };

  const pageNumbers = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++)
      pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage team members and their access roles"
        actions={
          <GlassButton onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Add User
          </GlassButton>
        }
      />

      {/* Role summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <GlassCard padding="sm" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/15">
            <Users className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="text-xs text-t3">Total</p>
            <p className="text-xl font-bold text-t1">{total}</p>
          </div>
        </GlassCard>
        <GlassCard padding="sm" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/15">
            <Shield className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="text-xs text-t3">Owners</p>
            <p className="text-xl font-bold text-t1">{ownerCount}</p>
          </div>
        </GlassCard>
        <GlassCard padding="sm" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(50,184,255,0.15)]">
            <UserCog className="h-5 w-5 text-info" />
          </div>
          <div>
            <p className="text-xs text-t3">Managers</p>
            <p className="text-xl font-bold text-t1">{managerCount}</p>
          </div>
        </GlassCard>
        <GlassCard padding="sm" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(142,142,147,0.15)]">
            <User className="h-5 w-5 text-t2" />
          </div>
          <div>
            <p className="text-xs text-t3">Staff</p>
            <p className="text-xl font-bold text-t1">{staffCount}</p>
          </div>
        </GlassCard>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1 relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-t3">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </span>
          <GlassInput
            placeholder="Search users..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <div className="w-44 shrink-0">
            <GlassSelect value={sort} onValueChange={handleSort} options={SORT_OPTIONS} />
          </div>
          <GlassButton
            variant="secondary"
            size="sm"
            onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
            aria-label={order === "asc" ? "Sort descending" : "Sort ascending"}
          >
            {order === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </GlassButton>
          <div className="flex items-center rounded-xl border border-line bg-surface p-0.5">
            <button
              onClick={() => setView("grid")}
              aria-label="Grid view"
              className={cn(
                "flex items-center justify-center rounded-lg p-1.5 transition-all",
                view === "grid" ? "bg-accent text-white shadow-sm" : "text-t3 hover:text-t1"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("table")}
              aria-label="Table view"
              className={cn(
                "flex items-center justify-center rounded-lg p-1.5 transition-all",
                view === "table" ? "bg-accent text-white shadow-sm" : "text-t3 hover:text-t1"
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {view === "table" ? (
        <UserTable
          users={allUsers}
          isLoading={isLoading}
          pageOffset={pageOffset}
          currentUserId={session?.user?.id}
        />
      ) : (
        <UserGrid
          users={allUsers}
          isLoading={isLoading}
          currentUserId={session?.user?.id}
        />
      )}

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-3.5">
        <span className="text-sm text-t2">{total} users</span>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-t2">
            Per page
            <div className="w-20">
              <GlassSelect
                value={String(limit)}
                onValueChange={handleLimit}
                options={PER_PAGE_OPTIONS}
              />
            </div>
          </div>
          <GlassButton variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </GlassButton>
          <div className="flex items-center gap-1">
            {pageNumbers.map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="px-1 text-sm text-t3">
                  ...
                </span>
              ) : (
                <GlassButton
                  key={p}
                  variant={p === page ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setPage(p as number)}
                  className="min-w-[2.25rem]"
                >
                  {p}
                </GlassButton>
              )
            )}
          </div>
          <span className="text-sm text-t2">
            Page {page} of {totalPages}
          </span>
          <GlassButton
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </GlassButton>
        </div>
      </div>

      <GlassModal open={creating} onOpenChange={setCreating} title="New User">
        <UserForm
          onSubmit={(d) =>
            createUser.mutate(d as CreateUserInput, { onSuccess: () => setCreating(false) })
          }
          isLoading={createUser.isPending}
          onCancel={() => setCreating(false)}
        />
      </GlassModal>
    </div>
  );
}

interface UserListItem {
  id: string;
  username: string;
  role: string;
  createdAt: string;
}

const ROLE_CONFIG: Record<string, { label: string; bgClass: string; icon: typeof Shield }> = {
  owner: { label: "Owner", bgClass: "bg-accent/15 text-accent", icon: Shield },
  manager: { label: "Manager", bgClass: "bg-info/15 text-info", icon: UserCog },
  staff: { label: "Staff", bgClass: "bg-surface-hover text-t2", icon: User },
};

function UserGrid({
  users,
  isLoading,
  currentUserId,
}: {
  users: UserListItem[];
  isLoading?: boolean;
  currentUserId?: string;
}) {
  const [editing, setEditing] = useState<UserListItem | null>(null);
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-line bg-surface h-28" />
        ))}
      </div>
    );
  }
  if (!users.length) {
    return <p className="py-12 text-center text-sm text-t3">No users found</p>;
  }
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {users.map((u) => {
          const cfg = ROLE_CONFIG[u.role] ?? ROLE_CONFIG.staff;
          const RoleIcon = cfg.icon;
          const isSelf = u.id === currentUserId;
          return (
            <div
              key={u.id}
              className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 transition-all hover:border-accent/30 hover:shadow-md hover:shadow-black/5"
            >
              <div className="flex items-center gap-3">
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold", cfg.bgClass)}>
                  {u.username.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-t1">{u.username}</p>
                  <p className="text-xs text-t3">{new Date(u.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <GlassBadge variant={u.role === "owner" ? "default" : u.role === "manager" ? "info" : "neutral"}>
                  <RoleIcon className="h-3 w-3" />
                  {cfg.label}
                </GlassBadge>
                <div className="flex items-center gap-1">
                  <GlassButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(u)}
                    aria-label="Edit user"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </GlassButton>
                  {!isSelf && (
                    <GlassButton
                      variant="ghost"
                      size="sm"
                      onClick={() => { if (confirm("Delete this user?")) deleteUser.mutate(u.id); }}
                      className="hover:text-danger"
                      aria-label="Delete user"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </GlassButton>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {editing && (
        <GlassModal open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }} title="Edit User">
          <UserForm
            defaultValues={{ id: editing.id, username: editing.username, role: editing.role }}
            onSubmit={(d) =>
              updateUser.mutate(
                { id: editing.id, ...(d as UpdateUserInput) },
                { onSuccess: () => setEditing(null) }
              )
            }
            isLoading={updateUser.isPending}
            onCancel={() => setEditing(null)}
          />
        </GlassModal>
      )}
    </>
  );
}
