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
import { Plus, Receipt } from "lucide-react";
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
      <div className="grid grid-cols-2 gap-4 max-w-sm">
        <GlassCard padding="sm">
          <p className="text-xs text-white/50 mb-1">Showing Total</p>
          <p className="text-lg font-bold text-[#FF3B30]">{formatCurrency(totalShown)}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <p className="text-xs text-white/50 mb-1">Records</p>
          <p className="text-lg font-bold text-white/90">{data?.meta?.total ?? 0}</p>
        </GlassCard>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="w-72">
          <GlassInput
            placeholder="Search description..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="w-44">
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
          <span className="text-sm text-white/50">Page {page} of {data.meta.totalPages}</span>
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
