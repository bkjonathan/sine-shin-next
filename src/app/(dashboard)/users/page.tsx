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
} from "lucide-react";
import type { CreateUserInput } from "@/validations/user.schema";

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
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48 relative">
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
        <div className="ml-auto flex items-center gap-2">
          <div className="w-44">
            <GlassSelect
              value={sort}
              onValueChange={handleSort}
              options={SORT_OPTIONS}
            />
          </div>
          <GlassButton
            variant="secondary"
            size="sm"
            onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
            aria-label={order === "asc" ? "Sort descending" : "Sort ascending"}
          >
            {order === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </GlassButton>
        </div>
      </div>

      <UserTable
        users={allUsers}
        isLoading={isLoading}
        pageOffset={pageOffset}
        currentUserId={session?.user?.id}
      />

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
