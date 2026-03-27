"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createExpenseSchema, EXPENSE_CATEGORIES, type CreateExpenseInput } from "@/validations/expense.schema";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassTextarea } from "@/components/ui/glass-textarea";
import { GlassSelect } from "@/components/ui/glass-select";
import { GlassButton } from "@/components/ui/glass-button";
import { format } from "date-fns";
import type { Expense } from "@/types";

interface ExpenseFormProps {
  defaultValues?: Partial<Expense>;
  onSubmit: (data: CreateExpenseInput) => void;
  isLoading?: boolean;
  onCancel?: () => void;
}

const categoryOptions = EXPENSE_CATEGORIES.map((c) => ({
  value: c,
  label: c.charAt(0).toUpperCase() + c.slice(1),
}));

export function ExpenseForm({ defaultValues, onSubmit, isLoading, onCancel }: ExpenseFormProps) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      category: (defaultValues?.category as CreateExpenseInput["category"]) ?? "other",
      amount: defaultValues?.amount ?? 0,
      description: defaultValues?.description ?? "",
      date: defaultValues?.date ?? format(new Date(), "yyyy-MM-dd"),
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <GlassSelect
          label="Category *"
          options={categoryOptions}
          value={watch("category")}
          onValueChange={(v) => setValue("category", v as CreateExpenseInput["category"])}
          error={errors.category?.message}
        />
        <GlassInput
          label="Amount *"
          type="number"
          min={0}
          step={0.01}
          placeholder="0.00"
          error={errors.amount?.message}
          {...register("amount", { valueAsNumber: true })}
        />
      </div>

      <GlassInput
        label="Date *"
        type="date"
        error={errors.date?.message}
        {...register("date")}
      />

      <GlassTextarea
        label="Description *"
        placeholder="What was this expense for?"
        error={errors.description?.message}
        {...register("description")}
      />

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && <GlassButton type="button" variant="secondary" onClick={onCancel}>Cancel</GlassButton>}
        <GlassButton type="submit" loading={isLoading}>
          {defaultValues?.id ? "Save Changes" : "Record Expense"}
        </GlassButton>
      </div>
    </form>
  );
}
