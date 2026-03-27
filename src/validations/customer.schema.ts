import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  phone: z.string().max(50).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  platform: z.enum(["Facebook", "TikTok", "Others"]).optional().nullable(),
  socialMediaUrl: z.string().max(500).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
