import { z } from "zod";

export const USER_ROLES = ["owner", "manager", "staff"] as const;

export const createUserSchema = z.object({
  username: z
    .string()
    .min(1, "Username is required")
    .max(100, "Username must be at most 100 characters")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username can only contain letters, numbers, dots, hyphens, and underscores"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password must be at most 128 characters"),
  role: z.enum(USER_ROLES),
});

export const updateUserSchema = z.object({
  username: z
    .string()
    .min(1, "Username is required")
    .max(100, "Username must be at most 100 characters")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username can only contain letters, numbers, dots, hyphens, and underscores")
    .optional(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password must be at most 128 characters")
    .optional()
    .or(z.literal("")),
  role: z.enum(USER_ROLES).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
