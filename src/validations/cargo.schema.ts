import { z } from "zod";

export const CARGO_STATUSES = ["pending", "in_transit", "arrived", "delivered", "cancelled"] as const;
export type CargoStatus = (typeof CARGO_STATUSES)[number];

export const CARGO_PARTY_TYPES = ["carrier", "receiver"] as const;
export type CargoPartyType = (typeof CARGO_PARTY_TYPES)[number];

export const createCargoCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  carrierRatePerKg: z.number().min(0, "Rate must be non-negative"),
  receiverRatePerKg: z.number().min(0, "Rate must be non-negative"),
  isActive: z.boolean().optional().default(true),
});

export const updateCargoCategorySchema = createCargoCategorySchema.partial();

export const cargoItemSchema = z
  .object({
    id: z.string().optional(),
    orderId: z.string().optional().nullable(),
    customerId: z.string().optional().nullable(),
    orderItemId: z.string().optional().nullable(),
    categoryId: z.string().optional().nullable(),
    weightKg: z.number().positive("Weight must be greater than 0"),
    carrierRatePerKg: z.number().min(0, "Rate must be non-negative"),
    receiverRatePerKg: z.number().min(0, "Rate must be non-negative"),
    note: z.string().max(500).optional().nullable(),
  })
  // An item comes either from an order or straight from a customer.
  .refine((d) => !!d.orderId || !!d.customerId, {
    message: "Select an order or a customer",
    path: ["orderId"],
  });

export const createCargoShipmentSchema = z.object({
  carrierName: z.string().max(255).optional().nullable(),
  carrierPhone: z.string().max(50).optional().nullable(),
  flightNumber: z.string().max(50).optional().nullable(),
  status: z.enum(CARGO_STATUSES),
  departureDate: z.string().optional().nullable(),
  arrivalDate: z.string().optional().nullable(),
  exchangeRate: z.number().positive(),
  notes: z.string().max(2000).optional().nullable(),
  items: z.array(cargoItemSchema).optional().default([]),
});

export const updateCargoShipmentSchema = createCargoShipmentSchema.partial();

export const cargoPaymentSchema = z
  .object({
    partyType: z.enum(CARGO_PARTY_TYPES),
    customerId: z.string().optional().nullable(),
    amount: z.number().positive("Amount must be greater than 0"),
    currency: z.string().min(1, "Currency is required").max(10),
    exchangeRate: z.number().positive().optional().nullable(),
    paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    method: z.string().max(50).optional().nullable(),
    note: z.string().max(1000).optional().nullable(),
  })
  .refine((d) => d.partyType !== "receiver" || !!d.customerId, {
    message: "Customer is required for receiver payments",
    path: ["customerId"],
  });

export type CreateCargoCategoryInput = z.infer<typeof createCargoCategorySchema>;
export type UpdateCargoCategoryInput = z.infer<typeof updateCargoCategorySchema>;
export type CargoItemInput = z.infer<typeof cargoItemSchema>;
export type CreateCargoShipmentInput = z.infer<typeof createCargoShipmentSchema>;
export type UpdateCargoShipmentInput = z.infer<typeof updateCargoShipmentSchema>;
export type CargoPaymentInput = z.infer<typeof cargoPaymentSchema>;
