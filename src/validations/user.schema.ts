import { z } from "zod";

export const USER_ROLES = ["owner", "manager", "staff"] as const;

// One minimum for every path that sets a password: create, owner reset and
// self-service change (AUDIT.md F-07). Existing passwords still sign in.
export const PASSWORD_MIN_LENGTH = 8;

export const createUserSchema = z.object({
  username: z
    .string()
    .min(1, "Username is required")
    .max(100, "Username must be at most 100 characters")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username can only contain letters, numbers, dots, hyphens, and underscores"),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
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
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(128, "Password must be at most 128 characters")
    .optional()
    .or(z.literal("")),
  role: z.enum(USER_ROLES).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
