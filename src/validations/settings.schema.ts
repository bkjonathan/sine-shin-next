import { z } from "zod";

export const updateSettingsSchema = z.object({
  shopName: z.string().min(1, "Shop name is required").max(255),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  logoUrl: z.string().url("Must be a valid URL").max(500).optional().nullable().or(z.literal("")),
  customerIdPrefix: z.string().min(1).max(20).toUpperCase().transform((v) => v.replace(/-+$/, "")),
  orderIdPrefix: z.string().min(1).max(20).toUpperCase().transform((v) => v.replace(/-+$/, "")),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
