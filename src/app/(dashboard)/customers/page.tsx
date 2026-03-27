"use client";

import { useState } from "react";
import { useCustomers, useCreateCustomer } from "@/hooks/use-customers";
import { CustomerTable } from "@/components/customers/customer-table";
import { PageHeader } from "@/components/layout/page-header";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassSelect } from "@/components/ui/glass-select";
import { GlassModal } from "@/components/ui/glass-modal";
import { CustomerForm } from "@/components/customers/customer-form";
import { Plus, Download, Upload, Printer, ArrowUp, ArrowDown, LayoutGrid, List } from "lucide-react";
import type { CreateCustomerInput } from "@/validations/customer.schema";
import type { Customer } from "@/types";
import Link from "next/link";

type SortOrder = "asc" | "desc";

const SEARCH_FIELD_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "customerId", label: "Customer ID" },
  { value: "phone", label: "Phone" },
];

const SORT_OPTIONS = [
  { value: "customerId", label: "Sort by ID" },
  { value: "name", label: "Sort by Name" },
  { value: "createdAt", label: "Sort by Date" },
];

const PER_PAGE_OPTIONS = [
  { value: "10", label: "10" },
  { value: "20", label: "20" },
  { value: "50", label: "50" },
];

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState("name");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sort, setSort] = useState("customerId");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [view, setView] = useState<"table" | "grid">("table");
  const [creating, setCreating] = useState(false);
  const createCustomer = useCreateCustomer();

  const { data, isLoading } = useCustomers({ page, search, searchField, limit, sort, order });

  const total = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.totalPages ?? 1;
  const pageOffset = (page - 1) * limit;

  const handleSearch = (val: string) => { setSearch(val); setPage(1); };
  const handleSort = (val: string) => { setSort(val); setPage(1); };
  const handleLimit = (val: string) => { setLimit(Number(val)); setPage(1); };

  const handleExportCSV = () => {
    const rows = data?.data ?? [];
    const header = ["#", "Name", "Customer ID", "Phone", "City", "Platform"];
    const body = rows.map((c, i) => [
      String(pageOffset + i + 1),
      c.name,
      c.customerId,
      c.phone ?? "",
      c.city ?? "",
      c.platform ?? "",
    ]);
    const csv = [header, ...body].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "customers.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const pageNumbers = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage your customers"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <GlassButton variant="secondary" size="sm">
              <Upload className="h-4 w-4" /> Import CSV
            </GlassButton>
            <GlassButton variant="secondary" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4" /> Export CSV
            </GlassButton>
            <GlassButton variant="secondary" size="sm">
              <Printer className="h-4 w-4" /> Label Print
            </GlassButton>
            <GlassButton onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Add Customer
            </GlassButton>
          </div>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-40">
          <GlassSelect
            value={searchField}
            onValueChange={(v) => { setSearchField(v); setPage(1); }}
            options={SEARCH_FIELD_OPTIONS}
          />
        </div>
        <div className="flex-1 min-w-48 relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-t3">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </span>
          <GlassInput
            placeholder="Search customers..."
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
            onClick={() => setOrder(o => o === "asc" ? "desc" : "asc")}
            aria-label={order === "asc" ? "Sort descending" : "Sort ascending"}
          >
            {order === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </GlassButton>
          <GlassButton
            variant={view === "grid" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setView("grid")}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </GlassButton>
          <GlassButton
            variant={view === "table" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setView("table")}
            aria-label="Table view"
          >
            <List className="h-4 w-4" />
          </GlassButton>
        </div>
      </div>

      {view === "table" ? (
        <CustomerTable customers={data?.data ?? []} isLoading={isLoading} pageOffset={pageOffset} />
      ) : (
        <CustomerGrid customers={data?.data ?? []} isLoading={isLoading} />
      )}

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-3.5">
        <span className="text-sm text-t2">{total} customers</span>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-t2">
            Per page
            <div className="w-20">
              <GlassSelect value={String(limit)} onValueChange={handleLimit} options={PER_PAGE_OPTIONS} />
            </div>
          </div>
          <GlassButton variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </GlassButton>
          <div className="flex items-center gap-1">
            {pageNumbers.map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="px-1 text-sm text-t3">...</span>
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
          <span className="text-sm text-t2">Page {page} of {totalPages}</span>
          <GlassButton variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next
          </GlassButton>
        </div>
      </div>

      <GlassModal open={creating} onOpenChange={setCreating} title="New Customer">
        <CustomerForm
          onSubmit={(d: CreateCustomerInput) => createCustomer.mutate(d, { onSuccess: () => setCreating(false) })}
          isLoading={createCustomer.isPending}
          onCancel={() => setCreating(false)}
        />
      </GlassModal>
    </div>
  );
}

function CustomerGrid({ customers, isLoading }: { customers: Customer[]; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-line bg-surface h-36" />
        ))}
      </div>
    );
  }
  if (!customers.length) {
    return <p className="py-12 text-center text-sm text-t3">No customers found</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {customers.map((c) => (
        <Link
          key={c.id}
          href={`/customers/${c.id}`}
          className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-surface-hover"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
              {c.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-t1">{c.name}</p>
              <p className="text-xs text-t3">{c.customerId}</p>
            </div>
          </div>
          <div className="space-y-1 text-xs text-t2">
            {c.phone && <p>{c.phone}</p>}
            {c.city && <p>{c.city}</p>}
          </div>
          {c.platform && (
            <span className="self-start rounded-full border border-line bg-surface-hover px-2.5 py-0.5 text-xs text-t2">
              {c.platform}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
