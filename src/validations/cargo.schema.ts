import { z } from "zod";
import {
  AMOUNT_LIMIT, LIST_LIMIT, MAX_AMOUNT, MAX_ID, MAX_LIST, MAX_RATE, MAX_WEIGHT_KG, RATE_LIMIT, WEIGHT_LIMIT,
  isoDate, optionalIsoDate,
} from "./limits";

export const CARGO_STATUSES = ["pending", "in_transit", "arrived", "delivered", "cancelled"] as const;
export type CargoStatus = (typeof CARGO_STATUSES)[number];

export const CARGO_PARTY_TYPES = ["carrier", "receiver"] as const;
export type CargoPartyType = (typeof CARGO_PARTY_TYPES)[number];

export const CARGO_EXPENSE_CATEGORIES = [
  "customs",
  "handling",
  "transport",
  "packaging",
  "insurance",
  "tax",
  "other",
] as const;
export type CargoExpenseCategory = (typeof CARGO_EXPENSE_CATEGORIES)[number];

export const createCargoCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  carrierRatePerKg: z.number().min(0, "Rate must be non-negative").max(MAX_AMOUNT, AMOUNT_LIMIT),
  receiverRatePerKg: z.number().min(0, "Rate must be non-negative").max(MAX_AMOUNT, AMOUNT_LIMIT),
  isActive: z.boolean().optional().default(true),
});

export const updateCargoCategorySchema = createCargoCategorySchema.partial();

export const cargoItemSchema = z
  .object({
    id: z.string().max(MAX_ID).optional(),
    orderId: z.string().max(MAX_ID).optional().nullable(),
    customerId: z.string().max(MAX_ID).optional().nullable(),
    orderItemId: z.string().max(MAX_ID).optional().nullable(),
    categoryId: z.string().max(MAX_ID).optional().nullable(),
    bagLabel: z.string().max(100).optional().nullable(),
    weightKg: z.number().positive("Weight must be greater than 0").max(MAX_WEIGHT_KG, WEIGHT_LIMIT),
    carrierRatePerKg: z.number().min(0, "Rate must be non-negative").max(MAX_AMOUNT, AMOUNT_LIMIT),
    receiverRatePerKg: z.number().min(0, "Rate must be non-negative").max(MAX_AMOUNT, AMOUNT_LIMIT),
    note: z.string().max(500).optional().nullable(),
  })
  // An item comes either from an order or straight from a customer.
  .refine((d) => !!d.orderId || !!d.customerId, {
    message: "Select an order or a customer",
    path: ["orderId"],
  });

// Editing an item already in a shipment. Which order/customer it came from is
// fixed at creation, so only the packing and pricing fields are editable.
export const updateCargoItemSchema = z.object({
  categoryId: z.string().max(MAX_ID).optional().nullable(),
  bagLabel: z.string().max(100).optional().nullable(),
  weightKg: z.number().positive("Weight must be greater than 0").max(MAX_WEIGHT_KG, WEIGHT_LIMIT),
  carrierRatePerKg: z.number().min(0, "Rate must be non-negative").max(MAX_AMOUNT, AMOUNT_LIMIT),
  receiverRatePerKg: z.number().min(0, "Rate must be non-negative").max(MAX_AMOUNT, AMOUNT_LIMIT),
  note: z.string().max(500).optional().nullable(),
});

export const createCargoShipmentSchema = z.object({
  carrierName: z.string().max(255).optional().nullable(),
  carrierPhone: z.string().max(50).optional().nullable(),
  flightNumber: z.string().max(50).optional().nullable(),
  status: z.enum(CARGO_STATUSES),
  departureDate: optionalIsoDate,
  arrivalDate: optionalIsoDate,
  exchangeRate: z.number().positive().max(MAX_RATE, RATE_LIMIT),
  notes: z.string().max(2000).optional().nullable(),
  items: z.array(cargoItemSchema).max(MAX_LIST, LIST_LIMIT).optional().default([]),
});

export const updateCargoShipmentSchema = createCargoShipmentSchema.partial();

export const cargoPaymentSchema = z
  .object({
    partyType: z.enum(CARGO_PARTY_TYPES),
    customerId: z.string().max(MAX_ID).optional().nullable(),
    // In the payment's currency, so a receiver payment in kyat must fit too.
    amount: z.number().positive("Amount must be greater than 0").max(MAX_AMOUNT, AMOUNT_LIMIT),
    // Which currencies are allowed depends on shop settings; checked in the route (AUDIT.md F-11).
    currency: z.string().trim().toUpperCase().min(1, "Currency is required").max(10),
    exchangeRate: z.number().positive().max(MAX_RATE, RATE_LIMIT).optional().nullable(),
    paidAt: isoDate,
    method: z.string().max(50).optional().nullable(),
    note: z.string().max(1000).optional().nullable(),
  })
  .refine((d) => d.partyType !== "receiver" || !!d.customerId, {
    message: "Customer is required for receiver payments",
    path: ["customerId"],
  });

export const cargoExpenseSchema = z.object({
  category: z.enum(CARGO_EXPENSE_CATEGORIES),
  description: z.string().max(255).optional().nullable(),
  amount: z.number().positive("Amount must be greater than 0").max(MAX_AMOUNT, AMOUNT_LIMIT),
  incurredAt: isoDate,
  note: z.string().max(1000).optional().nullable(),
});

// A DELETE body names the record to move to the trash (AUDIT.md F-24).
const recordId = z.string().min(1).max(MAX_ID);
export const deleteCargoItemSchema = z.object({ itemId: recordId });
export const deleteCargoPaymentSchema = z.object({ paymentId: recordId });
export const deleteCargoExpenseSchema = z.object({ expenseId: recordId });

export type CreateCargoCategoryInput = z.infer<typeof createCargoCategorySchema>;
export type UpdateCargoCategoryInput = z.infer<typeof updateCargoCategorySchema>;
export type CargoItemInput = z.infer<typeof cargoItemSchema>;
export type UpdateCargoItemInput = z.infer<typeof updateCargoItemSchema>;
export type CreateCargoShipmentInput = z.infer<typeof createCargoShipmentSchema>;
export type UpdateCargoShipmentInput = z.infer<typeof updateCargoShipmentSchema>;
export type CargoPaymentInput = z.infer<typeof cargoPaymentSchema>;
export type CargoExpenseInput = z.infer<typeof cargoExpenseSchema>;
