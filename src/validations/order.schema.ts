import { z } from "zod";

export const ORDER_STATUSES = ["pending", "processing", "arrived", "completed"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orderItemSchema = z.object({
  id: z.string().optional(),
  productUrl: z.string().url("Must be a valid URL").optional().nullable(),
  productQty: z.number().int().positive("Quantity must be positive").optional().nullable(),
  price: z.number().min(0, "Price must be non-negative").optional().nullable(),
  productWeight: z.number().min(0).optional().nullable(),
});

export const createOrderSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  status: z.enum(ORDER_STATUSES),
  orderFrom: z.string().optional().nullable(),
  shippingFee: z.number().min(0),
  deliveryFee: z.number().min(0),
  cargoFee: z.number().min(0),
  serviceFee: z.number().min(0),
  exchangeRate: z.number().positive(),
  items: z.array(orderItemSchema).optional().default([]),
});

export const updateOrderSchema = createOrderSchema.partial();

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
