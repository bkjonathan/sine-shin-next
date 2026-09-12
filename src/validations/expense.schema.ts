import { z } from "zod";
import { AMOUNT_LIMIT, MAX_AMOUNT, isoDate } from "./limits";

export const EXPENSE_CATEGORIES = [
  "shipping",
  "supplies",
  "rent",
  "utilities",
  "salary",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const createExpenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number().positive("Amount must be greater than 0").max(MAX_AMOUNT, AMOUNT_LIMIT),
  description: z.string().min(1, "Description is required").max(1000),
  date: isoDate,
});

export const updateExpenseSchema = createExpenseSchema.partial();

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
