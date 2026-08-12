"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { orderItemSchema, type OrderItemInput } from "@/validations/order.schema";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassInput } from "@/components/ui/glass-input";
import { useAddOrderItem, useRemoveOrderItem, useUpdateOrderItem } from "@/hooks/use-orders";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import type { OrderItem } from "@/types";

interface OrderItemsSectionProps {
  orderId: string;
  items: OrderItem[];
}

/** Draft of the row currently open for inline editing — kept as strings so a
 *  half-typed number never collapses to 0 while the user is mid-keystroke. */
interface EditDraft {
  productUrl: string;
  productQty: string;
  price: string;
  productWeight: string;
}

const CELL_INPUT =
  "rounded-xl px-2.5 py-1.5 text-sm [box-shadow:none] disabled:opacity-60";

function toDraft(item: OrderItem): EditDraft {
  return {
    productUrl: item.productUrl ?? "",
    productQty: item.productQty != null ? String(item.productQty) : "",
    price: item.price != null ? String(item.price) : "",
    productWeight: item.productWeight != null ? String(item.productWeight) : "",
  };
}

/** Empty input clears the column; anything unparseable leaves it untouched. */
function toNumber(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function OrderItemsSection({ orderId, items }: OrderItemsSectionProps) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const addItem = useAddOrderItem();
  const removeItem = useRemoveOrderItem();
  const updateItem = useUpdateOrderItem();
  const router = useRouter();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<OrderItemInput>({
    resolver: zodResolver(orderItemSchema),
    defaultValues: { productQty: 1, price: 0 },
  });

  function onAdd(data: OrderItemInput) {
    addItem.mutate(
      { orderId, ...data },
      { onSuccess: () => { reset(); setAdding(false); router.refresh(); } }
    );
  }

  function startEdit(item: OrderItem) {
    setEditingId(item.id);
    setDraft(toDraft(item));
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function saveEdit(itemId: string) {
    if (!draft) return;
    const qty = toNumber(draft.productQty);
    const price = toNumber(draft.price);
    const weight = toNumber(draft.productWeight);
    if (qty === undefined || price === undefined || weight === undefined) return;

    updateItem.mutate(
      {
        orderId,
        itemId,
        productUrl: draft.productUrl.trim() || null,
        productQty: qty,
        price,
        productWeight: weight,
      },
      { onSuccess: () => { cancelEdit(); router.refresh(); } }
    );
  }

  function setField(field: keyof EditDraft, value: string) {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <div className="overflow-x-auto rounded-[24px] border border-line bg-surface shadow-[var(--shadow-sm)]">
          <table className="min-w-[560px] w-full text-sm">
            <thead>
              <tr className="border-b border-divide bg-topbar">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.18em] text-t3">Product URL</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.18em] text-t3">Qty</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.18em] text-t3">Price</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.18em] text-t3">Weight</th>
                <th className="px-4 py-2.5 w-20" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) =>
                editingId === item.id && draft ? (
                  <tr key={item.id} className="border-b border-divide last:border-0 bg-surface-hover">
                    <td className="max-w-xs px-4 py-2">
                      <GlassInput
                        value={draft.productUrl}
                        onChange={(e) => setField("productUrl", e.target.value)}
                        placeholder="https://..."
                        aria-label="Product URL"
                        className={CELL_INPUT}
                        disabled={updateItem.isPending}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <GlassInput
                        type="number"
                        min={1}
                        value={draft.productQty}
                        onChange={(e) => setField("productQty", e.target.value)}
                        aria-label="Quantity"
                        className={`${CELL_INPUT} text-right`}
                        disabled={updateItem.isPending}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <GlassInput
                        type="number"
                        min={0}
                        step={0.01}
                        value={draft.price}
                        onChange={(e) => setField("price", e.target.value)}
                        aria-label="Price"
                        className={`${CELL_INPUT} text-right`}
                        disabled={updateItem.isPending}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <GlassInput
                        type="number"
                        min={0}
                        step={0.001}
                        value={draft.productWeight}
                        onChange={(e) => setField("productWeight", e.target.value)}
                        aria-label="Weight (kg)"
                        className={`${CELL_INPUT} text-right`}
                        disabled={updateItem.isPending}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-0.5">
                        <GlassButton
                          variant="ghost"
                          size="sm"
                          onClick={() => saveEdit(item.id)}
                          loading={updateItem.isPending}
                          className="px-2 hover:text-accent"
                          aria-label="Save item"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </GlassButton>
                        <GlassButton
                          variant="ghost"
                          size="sm"
                          onClick={cancelEdit}
                          disabled={updateItem.isPending}
                          className="px-2"
                          aria-label="Cancel edit"
                        >
                          <X className="h-3.5 w-3.5" />
                        </GlassButton>
                      </div>
                    </td>
                  </tr>
                ) : (
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
                      <div className="flex items-center gap-0.5">
                        <GlassButton
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(item)}
                          className="px-2 hover:text-accent"
                          aria-label="Edit item"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </GlassButton>
                        <GlassButton
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem.mutate({ orderId, itemId: item.id }, { onSuccess: () => router.refresh() })}
                          className="px-2 hover:text-danger"
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </GlassButton>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {adding ? (
        <GlassCard padding="sm">
          <form onSubmit={handleSubmit(onAdd)} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-3">
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
