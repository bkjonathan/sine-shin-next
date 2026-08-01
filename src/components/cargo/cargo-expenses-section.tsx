"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Receipt } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassSelect } from "@/components/ui/glass-select";
import { useAddCargoExpense, useRemoveCargoExpense } from "@/hooks/use-cargo";
import { formatDate, cn } from "@/lib/utils";
import { CARGO_EXPENSE_CATEGORIES, type CargoExpenseCategory } from "@/validations/cargo.schema";
import type { CargoExpense } from "@/types";

interface CargoExpensesSectionProps {
  cargoShipmentId: string;
  expenses: CargoExpense[];
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  baseCurrencySymbol: string;
}

const categoryOptions = CARGO_EXPENSE_CATEGORIES.map((c) => ({
  value: c,
  label: c.charAt(0).toUpperCase() + c.slice(1),
}));

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function money(symbol: string, value: number) {
  return `${symbol} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function CargoExpensesSection({
  cargoShipmentId,
  expenses,
  grossProfit,
  totalExpenses,
  netProfit,
  baseCurrencySymbol,
}: CargoExpensesSectionProps) {
  const [adding, setAdding] = useState(false);
  const [category, setCategory] = useState<CargoExpenseCategory>("other");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [incurredAt, setIncurredAt] = useState(todayISO());
  const [note, setNote] = useState("");

  const addExpense = useAddCargoExpense();
  const removeExpense = useRemoveCargoExpense();
  const router = useRouter();

  function resetForm() {
    setCategory("other"); setDescription(""); setAmount(0); setIncurredAt(todayISO()); setNote("");
    setAdding(false);
  }

  function handleAdd() {
    if (amount <= 0) return;
    addExpense.mutate(
      {
        cargoShipmentId,
        category,
        description: description.trim() || null,
        amount,
        incurredAt,
        note: note.trim() || null,
      },
      { onSuccess: () => { resetForm(); router.refresh(); } }
    );
  }

  return (
    <GlassCard>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-t3">Cargo Expenses</h3>
      </div>

      {/* Gross margin → less expenses → net profit */}
      <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl border border-line bg-surface-hover p-3 text-center">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-t4">Gross Profit</p>
          <p className="text-sm font-semibold text-t1">{money(baseCurrencySymbol, grossProfit)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-t4">Expenses</p>
          <p className="text-sm font-semibold text-warning">− {money(baseCurrencySymbol, totalExpenses)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-t4">Net Profit</p>
          <p className={cn("text-sm font-semibold", netProfit >= 0 ? "text-success" : "text-danger")}>
            {money(baseCurrencySymbol, netProfit)}
          </p>
        </div>
      </div>

      {expenses.length > 0 && (
        <div className="mb-4 space-y-2">
          {expenses.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-t1">{money(baseCurrencySymbol, e.amount)}</span>
                  <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-t3">
                    {e.category}
                  </span>
                  {e.description && <span className="text-xs text-t2 truncate">{e.description}</span>}
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs text-t4">
                  <span>{formatDate(e.incurredAt)}</span>
                  {e.note && <span className="truncate">· {e.note}</span>}
                </div>
              </div>
              <GlassButton
                variant="ghost"
                size="sm"
                onClick={() => removeExpense.mutate({ cargoShipmentId, expenseId: e.id }, { onSuccess: () => router.refresh() })}
                className="shrink-0 hover:text-danger"
                aria-label="Remove expense"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </GlassButton>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <GlassSelect label="Category" options={categoryOptions} value={category} onValueChange={(v) => setCategory(v as CargoExpenseCategory)} />
            <GlassInput label="Amount" type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} />
          </div>
          <GlassInput label="Description" placeholder="e.g. Customs clearance" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <GlassInput label="Date" type="date" value={incurredAt} onChange={(e) => setIncurredAt(e.target.value)} />
            <GlassInput label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <GlassButton type="button" variant="secondary" size="sm" onClick={resetForm}>Cancel</GlassButton>
            <GlassButton
              type="button"
              size="sm"
              loading={addExpense.isPending}
              disabled={amount <= 0}
              onClick={handleAdd}
            >
              Add Expense
            </GlassButton>
          </div>
        </div>
      ) : (
        <GlassButton variant="secondary" size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Expense
        </GlassButton>
      )}

      {expenses.length === 0 && !adding && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-t4">
          <Receipt className="h-3.5 w-3.5" /> No expenses recorded yet.
        </p>
      )}
    </GlassCard>
  );
}
