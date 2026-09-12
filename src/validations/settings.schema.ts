import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "./user.schema";
import { MAX_RATE, RATE_LIMIT } from "./limits";

// Letters and digits only: display numbers are parsed back with
// split_part(id, '-', 2), so a "-" (or a LIKE wildcard) in a prefix breaks
// every later create. Input is still trimmed, uppercased and stripped of
// trailing dashes first (AUDIT.md F-19).
const idPrefix = z
  .string()
  .trim()
  .toUpperCase()
  .transform((v) => v.replace(/-+$/, ""))
  .pipe(z.string().regex(/^[A-Z0-9]{1,20}$/, "Use 1–20 letters or digits only"));

// Three letters like an ISO 4217 code, stored uppercase (AUDIT.md F-11).
const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter code, e.g. THB"));
const currencySymbol = z.string().trim().min(1, "Symbol is required").max(10);

export const updateSettingsSchema = z.object({
  shopName: z.string().min(1, "Shop name is required").max(255),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  // A web address only: it's used as an image source (AUDIT.md F-15).
  logoUrl: z.url({ protocol: /^https?$/, message: "Must be an http:// or https:// address" }).max(500).optional().nullable().or(z.literal("")),
  customerIdPrefix: idPrefix,
  orderIdPrefix: idPrefix,
  cargoIdPrefix: idPrefix,
  // Optional: leaving them out keeps the stored currency. Rules that depend on
  // stored data (codes differ, base locked once money exists) are in the route.
  currencyCode: currencyCode.optional(),
  currencySymbol: currencySymbol.optional(),
  exchangeCurrencyCode: currencyCode.optional(),
  exchangeCurrencySymbol: currencySymbol.optional(),
  // It pre-fills the rate on new orders, shipments and payments, so it has their limit (AUDIT.md F-15).
  defaultExchangeRate: z.number().positive("Rate must be greater than 0").max(MAX_RATE, RATE_LIMIT).optional(),
});

export const changePasswordSchema = z
  .object({
    // 128, as for every other password field (AUDIT.md F-07, F-15).
    currentPassword: z.string().min(1, "Current password is required").max(128),
    newPassword: z.string().min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`).max(128, "Password must be at most 128 characters"),
    confirmPassword: z.string().min(1).max(128),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
