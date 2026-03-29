"use client";

import { useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassBadge } from "@/components/ui/glass-badge";
import { GlassModal } from "@/components/ui/glass-modal";
import { ExpenseForm } from "./expense-form";
import { formatCurrency } from "@/lib/utils";
import { useUpdateExpense, useDeleteExpense } from "@/hooks/use-expenses";
import { useCurrencyPrefs } from "@/hooks/use-currency-prefs";
import { Pencil, Trash2 } from "lucide-react";
import type { Expense } from "@/types";
import type { CreateExpenseInput } from "@/validations/expense.schema";

interface ExpenseTableProps {
  expenses: Expense[];
  isLoading?: boolean;
}

const CATEGORY_VARIANT: Record<string, "neutral" | "info" | "warning" | "success"> = {
  shipping: "info",
  supplies: "neutral",
  rent: "warning",
  utilities: "warning",
  salary: "success",
  other: "neutral",
};

export function ExpenseTable({ expenses, isLoading }: ExpenseTableProps) {
  const [editing, setEditing] = useState<Expense | null>(null);
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const { prefs } = useCurrencyPrefs();

  const columns: ColumnDef<Expense>[] = [
    {
      id: "expenseId",
      header: "SORT BY ID",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-t2">
          {row.original.expenseId ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "description",
      header: "SORT BY TITLE",
      cell: ({ row }) => {
        const lines = row.original.description.split("\n");
        return (
          <div>
            <p className="font-semibold text-t1">{lines[0]}</p>
            {lines.length > 1 && (
              <p className="text-xs text-t3">{lines.slice(1).join(" ")}</p>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "date",
      header: "SORT BY DATE",
      cell: ({ row }) => {
        const dateStr = row.original.date;
        if (!dateStr) return <span className="text-sm text-t2">—</span>;
        const [y, m, d] = dateStr.split("-");
        return <span className="text-sm text-t2">{`${d}-${m}-${y}`}</span>;
      },
    },
    {
      accessorKey: "category",
      header: "CATEGORY",
      cell: ({ row }) => (
        <GlassBadge variant={CATEGORY_VARIANT[row.original.category] ?? "neutral"} className="capitalize">
          {row.original.category}
        </GlassBadge>
      ),
    },
    {
      accessorKey: "amount",
      header: "SORT BY AMOUNT",
      cell: ({ row }) => (
        <span className="font-semibold text-accent">{formatCurrency(row.original.amount, prefs.currencySymbol)}</span>
      ),
    },
    {
      id: "actions",
      header: "ACTIONS",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <GlassButton variant="ghost" size="sm" onClick={() => setEditing(row.original)} aria-label="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => { if (confirm("Delete this expense?")) deleteExpense.mutate(row.original.id); }}
            className="hover:text-danger"
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </GlassButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable columns={columns} data={expenses} isLoading={isLoading} emptyMessage="No expenses recorded" />

      <GlassModal open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title="Edit Expense">
        {editing && (
          <ExpenseForm
            defaultValues={editing}
            onSubmit={(data: CreateExpenseInput) =>
              updateExpense.mutate({ id: editing.id, ...data }, { onSuccess: () => setEditing(null) })
            }
            isLoading={updateExpense.isPending}
            onCancel={() => setEditing(null)}
          />
        )}
      </GlassModal>
    </>
  );
}
