import { z } from "zod";
import { isPercentServiceFee } from "@/lib/order-money";
import {
  AMOUNT_LIMIT, LIST_LIMIT, MAX_AMOUNT, MAX_ID, MAX_LIST, MAX_PERCENT, MAX_QUANTITY, MAX_RATE, MAX_WEIGHT_KG,
  QUANTITY_LIMIT, RATE_LIMIT, WEIGHT_LIMIT, optionalIsoDate,
} from "./limits";

// A DELETE body names the order item to move to the trash (AUDIT.md F-24).
export const deleteOrderItemSchema = z.object({ itemId: z.string().min(1).max(MAX_ID) });

export const ORDER_STATUSES = ["pending", "ordered", "arrived", "shipping", "completed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_FROM_OPTIONS = ["Facebook", "TikTok", "Telegram", "Line", "Instagram", "Other"] as const;

export const orderItemSchema = z.object({
  id: z.string().max(MAX_ID).optional(),
  // Any text: staff paste share text and app links as well as web addresses (owner's decision, AUDIT.md F-15).
  productUrl: z.string().max(2000).optional().nullable(),
  productQty: z.number().int().positive("Quantity must be positive").max(MAX_QUANTITY, QUANTITY_LIMIT).optional().nullable(),
  price: z.number().min(0, "Price must be non-negative").max(MAX_AMOUNT, AMOUNT_LIMIT).optional().nullable(),
  productWeight: z.number().min(0).max(MAX_WEIGHT_KG, WEIGHT_LIMIT).optional().nullable(),
});

/** A percentage service fee can't be more than 100% of the items (AUDIT.md F-15). */
export function serviceFeeWithinLimit(fee: number | null | undefined, type: string | null | undefined): boolean {
  return !isPercentServiceFee(type) || (fee ?? 0) <= MAX_PERCENT;
}
export const SERVICE_FEE_PERCENT_LIMIT = `A percentage service fee can be at most ${MAX_PERCENT}%`;

// The fields without the service-fee rule, because Zod refuses .partial() on a refined object.
const orderFields = z.object({
  customerId: z.string().min(1, "Customer is required").max(MAX_ID),
  status: z.enum(ORDER_STATUSES),
  orderFrom: z.string().max(100).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
  orderDate: optionalIsoDate,
  shipmentDate: optionalIsoDate,
  arrivedDate: optionalIsoDate,
  userWithdrawDate: optionalIsoDate,
  exchangeRate: z.number().positive().max(MAX_RATE, RATE_LIMIT),
  shippingFee: z.number().min(0).max(MAX_AMOUNT, AMOUNT_LIMIT),
  deliveryFee: z.number().min(0).max(MAX_AMOUNT, AMOUNT_LIMIT),
  cargoFee: z.number().min(0).max(MAX_AMOUNT, AMOUNT_LIMIT),
  serviceFee: z.number().min(0).max(MAX_AMOUNT, AMOUNT_LIMIT),
  serviceFeeType: z.preprocess(v => v === "%" ? "percent" : (v == null ? "percent" : v), z.enum(["fixed", "percent"])),
  productDiscount: z.number().min(0).max(MAX_AMOUNT, AMOUNT_LIMIT).optional().nullable(),
  shippingFeePaid: z.boolean().optional().nullable(),
  deliveryFeePaid: z.boolean().optional().nullable(),
  cargoFeePaid: z.boolean().optional().nullable(),
  serviceFeePaid: z.boolean().optional().nullable(),
  shippingFeeByShop: z.boolean().optional().nullable(),
  deliveryFeeByShop: z.boolean().optional().nullable(),
  cargoFeeByShop: z.boolean().optional().nullable(),
  excludeCargoFee: z.boolean().optional().nullable(),
  items: z.array(orderItemSchema).max(MAX_LIST, LIST_LIMIT).optional().default([]),
});

export const createOrderSchema = orderFields.refine((o) => serviceFeeWithinLimit(o.serviceFee, o.serviceFeeType), {
  message: SERVICE_FEE_PERCENT_LIMIT,
  path: ["serviceFee"],
});

// An edit that sends only the fee or only its type is checked in PATCH /api/orders/:id.
export const updateOrderSchema = orderFields.partial();

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
