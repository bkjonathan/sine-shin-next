"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { orderItemSchema, type OrderItemInput } from "@/validations/order.schema";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassInput } from "@/components/ui/glass-input";
import { useAddOrderItem, useRemoveOrderItem } from "@/hooks/use-orders";
import { Plus, Trash2 } from "lucide-react";
import type { OrderItem } from "@/types";

interface OrderItemsSectionProps {
  orderId: string;
  items: OrderItem[];
}

export function OrderItemsSection({ orderId, items }: OrderItemsSectionProps) {
  const [adding, setAdding] = useState(false);
  const addItem = useAddOrderItem();
  const removeItem = useRemoveOrderItem();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<OrderItemInput>({
    resolver: zodResolver(orderItemSchema),
    defaultValues: { productQty: 1, price: 0 },
  });

  function onAdd(data: OrderItemInput) {
    addItem.mutate(
      { orderId, ...data },
      { onSuccess: () => { reset(); setAdding(false); } }
    );
  }

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <div className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-[var(--shadow-sm)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-divide bg-topbar">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.18em] text-t3">Product URL</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.18em] text-t3">Qty</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.18em] text-t3">Price</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.18em] text-t3">Weight</th>
                <th className="px-4 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-divide last:border-0">
                  <td className="max-w-xs truncate px-4 py-3 text-t1">
                    {item.productUrl ? (
                      <a href={item.productUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                        {item.productUrl}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-t2">{item.productQty ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-t2">{item.price != null ? item.price.toFixed(2) : "—"}</td>
                  <td className="px-4 py-3 text-right text-t2">{item.productWeight != null ? `${item.productWeight} kg` : "—"}</td>
                  <td className="px-4 py-3">
                    <GlassButton
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem.mutate({ orderId, itemId: item.id })}
                      className="hover:text-danger"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </GlassButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding ? (
        <GlassCard padding="sm">
          <form onSubmit={handleSubmit(onAdd)} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3">
                <GlassInput label="Product URL" placeholder="https://..." error={errors.productUrl?.message} {...register("productUrl")} />
              </div>
              <GlassInput
                label="Quantity"
                type="number"
                min={1}
                error={errors.productQty?.message}
                {...register("productQty", { valueAsNumber: true })}
              />
              <GlassInput
                label="Price"
                type="number"
                min={0}
                step={0.01}
                error={errors.price?.message}
                {...register("price", { valueAsNumber: true })}
              />
              <GlassInput
                label="Weight (kg)"
                type="number"
                min={0}
                step={0.001}
                error={errors.productWeight?.message}
                {...register("productWeight", { valueAsNumber: true })}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <GlassButton type="button" variant="secondary" size="sm" onClick={() => setAdding(false)}>Cancel</GlassButton>
              <GlassButton type="submit" size="sm" loading={addItem.isPending}>Add Item</GlassButton>
            </div>
          </form>
        </GlassCard>
      ) : (
        <GlassButton variant="secondary" size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Item
        </GlassButton>
      )}
    </div>
  );
}
