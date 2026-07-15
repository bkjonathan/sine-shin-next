"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { createOrderSchema, ORDER_STATUSES, ORDER_FROM_OPTIONS, type CreateOrderInput } from "@/validations/order.schema";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassSelect } from "@/components/ui/glass-select";
import { GlassButton } from "@/components/ui/glass-button";
import { CustomerCombobox } from "@/components/orders/customer-combobox";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrencyPrefs } from "@/hooks/use-currency-prefs";
import type { Order } from "@/types";

interface OrderFormProps {
  defaultValues?: Partial<Order>;
  onSubmit: (data: CreateOrderInput) => void;
  isLoading?: boolean;
  onCancel?: () => void;
}

const statusOptions = ORDER_STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }));
const orderFromOptions = ORDER_FROM_OPTIONS.map((s) => ({ value: s, label: s }));

const round2 = (n: number) => Math.round(n * 100) / 100;

export function OrderForm({ defaultValues, onSubmit, isLoading, onCancel }: OrderFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<z.input<typeof createOrderSchema>, unknown, CreateOrderInput>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      customerId: defaultValues?.customerId ?? "",
      status: (defaultValues?.status as CreateOrderInput["status"]) ?? "pending",
      orderFrom: defaultValues?.orderFrom ?? "Facebook",
      orderDate: defaultValues?.orderDate ?? "",
      exchangeRate: defaultValues?.exchangeRate ?? undefined,
      shippingFee: defaultValues?.shippingFee ?? 0,
      deliveryFee: defaultValues?.deliveryFee ?? 0,
      cargoFee: defaultValues?.cargoFee ?? 0,
      serviceFee: defaultValues?.serviceFee ?? 0,
      serviceFeeType: defaultValues?.serviceFeeType ?? "percent",
      productDiscount: defaultValues?.productDiscount ?? 0,
      shippingFeeByShop: defaultValues?.shippingFeeByShop ?? false,
      deliveryFeeByShop: defaultValues?.deliveryFeeByShop ?? false,
      cargoFeeByShop: defaultValues?.cargoFeeByShop ?? false,
      excludeCargoFee: defaultValues?.excludeCargoFee ?? false,
      items: [{ productUrl: "", productQty: 1, price: 0, productWeight: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const { prefs } = useCurrencyPrefs();

  useEffect(() => {
    if (!defaultValues?.exchangeRate) {
      setValue("exchangeRate", prefs.exchangeRate);
    }
  }, [prefs.exchangeRate]);

  // ── Actual buy price ↔ product discount ──────────────────────────────
  // Buy price has no column of its own. It is stored implicitly: the discount
  // we save is (itemsSubtotal - buyPrice), so buy price can always be derived
  // back as (itemsSubtotal - productDiscount). The draft holds what the user
  // typed; clearing it re-derives the field from the discount.
  // Recomputed every render on purpose: watch() hands back the same array
  // reference each time (RHF mutates it in place), so memoizing on it never
  // invalidates.
  const watchedItems = watch("items");
  const itemsSubtotal = (watchedItems ?? []).reduce(
    (sum, i) => sum + (Number(i?.price) || 0) * (Number(i?.productQty) || 0),
    0
  );

  const [buyPriceDraft, setBuyPriceDraft] = useState<string | null>(null);
  const discountValue = Number(watch("productDiscount")) || 0;
  const buyPriceValue =
    buyPriceDraft ?? (itemsSubtotal > 0 ? String(round2(itemsSubtotal - discountValue)) : "");

  useEffect(() => {
    if (buyPriceDraft === null || buyPriceDraft.trim() === "") return;
    const bp = Number(buyPriceDraft);
    if (!Number.isFinite(bp)) return;
    setValue("productDiscount", Math.max(0, round2(itemsSubtotal - bp)), { shouldValidate: true });
  }, [itemsSubtotal]);

  function handleBuyPriceChange(raw: string) {
    setBuyPriceDraft(raw);
    const bp = Number(raw);
    const discount = raw.trim() === "" || !Number.isFinite(bp) ? 0 : Math.max(0, round2(itemsSubtotal - bp));
    setValue("productDiscount", discount, { shouldValidate: true });
  }

  const buyPriceNum = Number(buyPriceValue);
  const buyPriceHint = (() => {
    if (itemsSubtotal <= 0) return "Enter item prices first";
    if (Number.isFinite(buyPriceNum) && buyPriceNum > itemsSubtotal) {
      return `Above items total ${formatCurrency(itemsSubtotal, prefs.currencySymbol)} — discount held at 0`;
    }
    const margin = itemsSubtotal > 0 ? Math.round((discountValue / itemsSubtotal) * 100) : 0;
    return `Items total ${formatCurrency(itemsSubtotal, prefs.currencySymbol)} · discount ${formatCurrency(discountValue, prefs.currencySymbol)} (${margin}%)`;
  })();

  const discountField = register("productDiscount", { valueAsNumber: true });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* ── Basic Information ─────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-t1 mb-1">Basic Information</h3>
        <hr className="border-accent mb-4" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <CustomerCombobox
            label="Customer *"
            value={watch("customerId")}
            onValueChange={(v) => setValue("customerId", v)}
            error={errors.customerId?.message}
            placeholder="Select Customer"
          />
          <GlassSelect
            label="Order From"
            options={orderFromOptions}
            value={watch("orderFrom") ?? ""}
            onValueChange={(v) => setValue("orderFrom", v)}
          />
          <GlassSelect
            label="Status"
            options={statusOptions}
            value={watch("status")}
            onValueChange={(v) => setValue("status", v as CreateOrderInput["status"])}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 mt-4 sm:grid-cols-2">
          <GlassInput
            label="Exchange Rate"
            type="number"
            min={0.0001}
            step={0.0001}
            placeholder=""
            error={errors.exchangeRate?.message}
            {...register("exchangeRate", { valueAsNumber: true })}
          />
          <GlassInput
            label="Order Date *"
            type="date"
            error={errors.orderDate?.message}
            {...register("orderDate")}
          />
        </div>
      </section>

      {/* ── Product & Details ─────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-t1">Product &amp; Details</h3>
          <button
            type="button"
            onClick={() => append({ productUrl: "", productQty: 1, price: 0, productWeight: 0 })}
            className="flex items-center gap-1 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Item
          </button>
        </div>
        <hr className="border-line mb-4" />

        <div className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="rounded-2xl border border-line bg-field/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <GlassInput
                  label="Product URL (Optional)"
                  placeholder="https://..."
                  className="flex-1"
                  {...register(`items.${index}.productUrl`)}
                />
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="ml-3 mt-6 rounded-xl p-2 text-t3 hover:bg-surface-hover hover:text-danger transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <GlassInput
                  label="Qty"
                  type="number"
                  min={1}
                  step={1}
                  {...register(`items.${index}.productQty`, { valueAsNumber: true })}
                />
                <GlassInput
                  label="Price"
                  type="number"
                  min={0}
                  step={0.01}
                  {...register(`items.${index}.price`, { valueAsNumber: true })}
                />
                <GlassInput
                  label="Weight (kg)"
                  type="number"
                  min={0}
                  step={0.01}
                  {...register(`items.${index}.productWeight`, { valueAsNumber: true })}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Fees ──────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-t1 mb-1">Fees</h3>
        <hr className="border-line mb-4" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Service Fee with type toggle */}
          <div className="w-full">
            <label className="mb-1.5 block text-sm font-medium text-t2">Service Fee</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                step={0.01}
                className={cn(
                  "w-full rounded-2xl px-4 py-3 text-sm text-t1",
                  "bg-field border border-line",
                  "backdrop-blur-xl placeholder:text-t4",
                  "outline-none transition-all duration-200",
                  "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.12)]",
                  "focus:border-accent-border focus:bg-[var(--bg-panel)] focus:ring-4 focus:ring-accent-bg/60"
                )}
                {...register("serviceFee", { valueAsNumber: true })}
              />
              <button
                type="button"
                onClick={() => {
                  const current = watch("serviceFeeType");
                  setValue("serviceFeeType", current === "percent" ? "fixed" : "percent");
                }}
                className={cn(
                  "shrink-0 rounded-2xl px-4 py-3 text-sm font-medium",
                  "bg-field border border-line text-t2",
                  "hover:bg-surface-hover transition-colors"
                )}
              >
                {watch("serviceFeeType") === "percent" ? "%" : prefs.currencySymbol}
              </button>
            </div>
            {errors.serviceFee && <p className="mt-1.5 text-xs text-danger">{errors.serviceFee.message}</p>}
          </div>

          {/* Actual Buy Price — drives Product Discount, never stored itself */}
          <GlassInput
            label="Actual Buy Price"
            type="number"
            min={0}
            step={0.01}
            placeholder="What you paid"
            value={buyPriceValue}
            onChange={(e) => handleBuyPriceChange(e.target.value)}
            hint={buyPriceHint}
          />

          {/* Product Discount */}
          <GlassInput
            label="Product Discount"
            type="number"
            min={0}
            step={0.01}
            error={errors.productDiscount?.message}
            {...discountField}
            onChange={(e) => {
              discountField.onChange(e);
              setBuyPriceDraft(null);
            }}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 mt-4 sm:grid-cols-3">
          {/* Shipping Fee */}
          <div>
            <GlassInput
              label="Shipping Fee"
              type="number"
              min={0}
              step={0.01}
              error={errors.shippingFee?.message}
              {...register("shippingFee", { valueAsNumber: true })}
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-t3 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-line accent-accent"
                {...register("shippingFeeByShop")}
              />
              Shop Expense
            </label>
          </div>

          {/* Delivery Fee */}
          <div>
            <GlassInput
              label="Delivery Fee"
              type="number"
              min={0}
              step={0.01}
              error={errors.deliveryFee?.message}
              {...register("deliveryFee", { valueAsNumber: true })}
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-t3 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-line accent-accent"
                {...register("deliveryFeeByShop")}
              />
              Shop Expense
            </label>
          </div>

          {/* Cargo Fee */}
          <div>
            <GlassInput
              label="Cargo Fee"
              type="number"
              min={0}
              step={0.01}
              error={errors.cargoFee?.message}
              {...register("cargoFee", { valueAsNumber: true })}
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-t3 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-line accent-accent"
                {...register("cargoFeeByShop")}
              />
              Shop Expense
            </label>
            <label className="mt-1 flex items-center gap-2 text-xs text-t3 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-line accent-accent"
                {...register("excludeCargoFee")}
              />
              Exclude from Total
            </label>
          </div>
        </div>
      </section>

      {/* ── Actions ───────────────────────────────────────────────── */}
      <hr className="border-line" />
      <div className="flex justify-end gap-3 pt-2">
        {onCancel && <GlassButton type="button" variant="secondary" onClick={onCancel}>Cancel</GlassButton>}
        <GlassButton type="submit" loading={isLoading}>
          {defaultValues?.id ? "Save Changes" : "Create Order"}
        </GlassButton>
      </div>
    </form>
  );
}
