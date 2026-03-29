import { z } from "zod";

export const ORDER_STATUSES = ["pending", "processing", "arrived", "completed"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_FROM_OPTIONS = ["Facebook", "TikTok", "Telegram", "Line", "Instagram", "Other"] as const;

export const orderItemSchema = z.object({
  id: z.string().optional(),
  productUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
  productQty: z.number().int().positive("Quantity must be positive").optional().nullable(),
  price: z.number().min(0, "Price must be non-negative").optional().nullable(),
  productWeight: z.number().min(0).optional().nullable(),
});

export const createOrderSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  status: z.enum(ORDER_STATUSES),
  orderFrom: z.string().optional().nullable(),
  orderDate: z.string().optional().nullable(),
  shipmentDate: z.string().optional().nullable(),
  arrivedDate: z.string().optional().nullable(),
  userWithdrawDate: z.string().optional().nullable(),
  exchangeRate: z.number().positive(),
  shippingFee: z.number().min(0),
  deliveryFee: z.number().min(0),
  cargoFee: z.number().min(0),
  serviceFee: z.number().min(0),
  serviceFeeType: z.string().optional().nullable(),
  productDiscount: z.number().min(0).optional().nullable(),
  shippingFeePaid: z.boolean().optional().nullable(),
  deliveryFeePaid: z.boolean().optional().nullable(),
  cargoFeePaid: z.boolean().optional().nullable(),
  serviceFeePaid: z.boolean().optional().nullable(),
  shippingFeeByShop: z.boolean().optional().nullable(),
  deliveryFeeByShop: z.boolean().optional().nullable(),
  cargoFeeByShop: z.boolean().optional().nullable(),
  excludeCargoFee: z.boolean().optional().nullable(),
  items: z.array(orderItemSchema).optional().default([]),
});

export const updateOrderSchema = createOrderSchema.partial();

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
