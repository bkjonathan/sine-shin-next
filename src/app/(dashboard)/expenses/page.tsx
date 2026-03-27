"use client";

import { useState } from "react";
import { useExpenses, useCreateExpense } from "@/hooks/use-expenses";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { PageHeader } from "@/components/layout/page-header";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassSelect } from "@/components/ui/glass-select";
import { GlassModal } from "@/components/ui/glass-modal";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { formatCurrency } from "@/lib/utils";
import { Plus, Download, Upload, ArrowUp, ArrowDown, LayoutGrid, List } from "lucide-react";
import type { CreateExpenseInput } from "@/validations/expense.schema";
import { EXPENSE_CATEGORIES } from "@/validations/expense.schema";
import type { Expense } from "@/types";

type SortOrder = "asc" | "desc";

const SEARCH_FIELD_OPTIONS = [
  { value: "title", label: "Title" },
  { value: "expenseId", label: "Expense ID" },
];

const SORT_OPTIONS = [
  { value: "date", label: "Sort by Date" },
  { value: "expenseId", label: "Sort by ID" },
  { value: "title", label: "Sort by Title" },
  { value: "amount", label: "Sort by Amount" },
];

const PER_PAGE_OPTIONS = [
  { value: "10", label: "10" },
  { value: "20", label: "20" },
  { value: "50", label: "50" },
];

const categoryOptions = [
  { value: "all", label: "All" },
  ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
];

export default function ExpensesPage() {
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState("title");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sort, setSort] = useState("date");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [view, setView] = useState<"table" | "grid">("table");
  const [creating, setCreating] = useState(false);
  const createExpense = useCreateExpense();

  const { data, isLoading } = useExpenses({
    page, search, searchField,
    category: category === "all" ? "" : category,
    limit, sort, order,
  });

  const total = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.totalPages ?? 1;
  const stats = data?.meta?.stats;

  const handleSearch = (val: string) => { setSearch(val); setPage(1); };
  const handleSort = (val: string) => { setSort(val); setPage(1); };
  const handleLimit = (val: string) => { setLimit(Number(val)); setPage(1); };
  const handleCategory = (val: string) => { setCategory(val); setPage(1); };

  const handleExportCSV = () => {
    const rows = data?.data ?? [];
    const header = ["Expense ID", "Title", "Date", "Category", "Amount"];
    const body = rows.map((e) => [
      e.expenseId ?? "",
      e.description,
      e.date,
      e.category,
      String(e.amount),
    ]);
    const csv = [header, ...body].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "expenses.csv";
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
        title="Expense Records"
        description="Manage your business expenses"
        actions={
          <div className="flex flex-wrap items-center gap-2">
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
            <GlassButton variant="secondary" size="sm">
              <Upload className="h-4 w-4" /> Import CSV
            </GlassButton>
            <GlassButton variant="secondary" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4" /> Export CSV
            </GlassButton>
            <GlassButton onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Add Expense
            </GlassButton>
          </div>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-t3">Records</p>
          <p className="text-2xl font-bold text-t1">{stats?.records ?? total}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-t3">Total Expense</p>
          <p className="text-2xl font-bold text-accent">
            {formatCurrency(stats?.totalAmount ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-t3">This Month</p>
          <p className="text-2xl font-bold text-t1">
            {formatCurrency(stats?.thisMonthAmount ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-t3">Average Expense</p>
          <p className="text-2xl font-bold text-t1">
            {formatCurrency(stats?.avgAmount ?? 0)}
          </p>
        </div>
      </div>

      {/* Toolbar card */}
      <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-48 relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-t3">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
            </span>
            <GlassInput
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="w-44">
            <GlassSelect
              value={searchField}
              onValueChange={(v) => { setSearchField(v); setPage(1); }}
              options={SEARCH_FIELD_OPTIONS}
            />
          </div>
          <div className="w-44">
            <GlassSelect value={sort} onValueChange={handleSort} options={SORT_OPTIONS} />
          </div>
          <GlassButton
            variant="secondary"
            size="sm"
            onClick={() => setOrder(o => o === "asc" ? "desc" : "asc")}
            aria-label={order === "asc" ? "Sort descending" : "Sort ascending"}
          >
            {order === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </GlassButton>
        </div>
        <div className="w-56">
          <GlassSelect
            value={category}
            onValueChange={handleCategory}
            options={categoryOptions}
          />
        </div>
      </div>

      {view === "table" ? (
        <ExpenseTable expenses={data?.data ?? []} isLoading={isLoading} />
      ) : (
        <ExpenseGrid expenses={data?.data ?? []} isLoading={isLoading} />
      )}

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-3.5">
        <span className="text-sm text-t2">{total} expenses</span>
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

      <GlassModal open={creating} onOpenChange={setCreating} title="Record Expense">
        <ExpenseForm
          onSubmit={(d: CreateExpenseInput) => createExpense.mutate(d, { onSuccess: () => setCreating(false) })}
          isLoading={createExpense.isPending}
          onCancel={() => setCreating(false)}
        />
      </GlassModal>
    </div>
  );
}

function ExpenseGrid({ expenses, isLoading }: { expenses: Expense[]; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-line bg-surface h-28" />
        ))}
      </div>
    );
  }
  if (!expenses.length) {
    return <p className="py-12 text-center text-sm text-t3">No expenses found</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {expenses.map((e) => (
        <div key={e.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-t1">{e.description.split("\n")[0]}</p>
              {e.description.includes("\n") && (
                <p className="text-xs text-t3">{e.description.split("\n").slice(1).join(" ")}</p>
              )}
            </div>
            <span className="shrink-0 text-base font-bold text-accent">{formatCurrency(e.amount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="rounded-full border border-line bg-surface-hover px-2.5 py-0.5 text-xs text-t2 capitalize">
              {e.category}
            </span>
            <span className="text-xs text-t3">{e.date}</span>
          </div>
          {e.expenseId && (
            <span className="font-mono text-xs text-t3">{e.expenseId}</span>
          )}
        </div>
      ))}
    </div>
  );
}
