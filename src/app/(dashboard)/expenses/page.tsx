"use client";

import { useState } from "react";
import { useExpenses } from "@/hooks/use-expenses";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { PageHeader } from "@/components/layout/page-header";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassSelect } from "@/components/ui/glass-select";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassModal } from "@/components/ui/glass-modal";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { useCreateExpense } from "@/hooks/use-expenses";
import { formatCurrency } from "@/lib/utils";
import { Plus } from "lucide-react";
import type { CreateExpenseInput } from "@/validations/expense.schema";
import { EXPENSE_CATEGORIES } from "@/validations/expense.schema";

const categoryOptions = [
  { value: "all", label: "All categories" },
  ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
];

export default function ExpensesPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const createExpense = useCreateExpense();

  const { data, isLoading } = useExpenses({ page, search, category: category === "all" ? "" : category, limit: 20 });

  const totalShown = (data?.data ?? []).reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Track your business expenses"
        actions={
          <GlassButton onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Record Expense
          </GlassButton>
        }
      />

      {/* Summary cards */}
      <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <GlassCard padding="sm">
          <p className="mb-1 text-xs text-t3">Showing Total</p>
          <p className="text-lg font-bold text-danger">{formatCurrency(totalShown)}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <p className="mb-1 text-xs text-t3">Records</p>
          <p className="text-lg font-bold text-t1">{data?.meta?.total ?? 0}</p>
        </GlassCard>
      </div>

      <div className="grid gap-3 rounded-[28px] border border-line bg-surface p-4 shadow-[var(--shadow-card)] md:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="min-w-0">
          <GlassInput
            placeholder="Search description..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="min-w-0">
          <GlassSelect
            options={categoryOptions}
            value={category}
            onValueChange={(v) => { setCategory(v); setPage(1); }}
            placeholder="All categories"
          />
        </div>
      </div>

      <ExpenseTable expenses={data?.data ?? []} isLoading={isLoading} />

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <GlassButton variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</GlassButton>
          <span className="text-sm text-t2">Page {page} of {data.meta.totalPages}</span>
          <GlassButton variant="secondary" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(p => p + 1)}>Next</GlassButton>
        </div>
      )}

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
