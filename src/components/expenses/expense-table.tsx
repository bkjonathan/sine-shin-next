"use client";

import { useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassBadge } from "@/components/ui/glass-badge";
import { GlassModal } from "@/components/ui/glass-modal";
import { ExpenseForm } from "./expense-form";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useCreateExpense, useUpdateExpense, useDeleteExpense } from "@/hooks/use-expenses";
import { Pencil, Trash2 } from "lucide-react";
import type { Expense } from "@/types";
import type { CreateExpenseInput } from "@/validations/expense.schema";

interface ExpenseTableProps {
  expenses: Expense[];
  isLoading?: boolean;
}

export function ExpenseTable({ expenses, isLoading }: ExpenseTableProps) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();

  const columns: ColumnDef<Expense>[] = [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => formatDate(row.original.date),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => (
        <GlassBadge variant="neutral" className="capitalize">{row.original.category}</GlassBadge>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => <span className="text-white/70">{row.original.description}</span>,
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => (
        <span className="font-semibold text-[#FF3B30]">{formatCurrency(row.original.amount)}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <GlassButton variant="ghost" size="sm" onClick={() => setEditing(row.original)} aria-label="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => { if (confirm("Delete this expense?")) deleteExpense.mutate(row.original.id); }}
            className="hover:text-[#FF3B30]"
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

      <GlassModal open={creating} onOpenChange={setCreating} title="Record Expense">
        <ExpenseForm
          onSubmit={(data: CreateExpenseInput) => createExpense.mutate(data, { onSuccess: () => setCreating(false) })}
          isLoading={createExpense.isPending}
          onCancel={() => setCreating(false)}
        />
      </GlassModal>

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
