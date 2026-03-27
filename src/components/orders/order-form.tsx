"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createOrderSchema, ORDER_STATUSES, type CreateOrderInput } from "@/validations/order.schema";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassSelect } from "@/components/ui/glass-select";
import { GlassButton } from "@/components/ui/glass-button";
import { useCustomers } from "@/hooks/use-customers";
import type { Order } from "@/types";

interface OrderFormProps {
  defaultValues?: Partial<Order>;
  onSubmit: (data: CreateOrderInput) => void;
  isLoading?: boolean;
  onCancel?: () => void;
}

const statusOptions = ORDER_STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }));

export function OrderForm({ defaultValues, onSubmit, isLoading, onCancel }: OrderFormProps) {
  const { data: customersData } = useCustomers({ limit: 100 });
  const customers = customersData?.data ?? [];

  const customerOptions = customers.map((c) => ({ value: c.id, label: `${c.name} (${c.customerId})` }));

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<z.input<typeof createOrderSchema>, unknown, CreateOrderInput>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      customerId: defaultValues?.customerId ?? "",
      status: (defaultValues?.status as CreateOrderInput["status"]) ?? "pending",
      shippingFee: defaultValues?.shippingFee ?? 0,
      deliveryFee: defaultValues?.deliveryFee ?? 0,
      cargoFee: defaultValues?.cargoFee ?? 0,
      serviceFee: defaultValues?.serviceFee ?? 0,
      exchangeRate: defaultValues?.exchangeRate ?? 1,
      items: [],
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <GlassSelect
          label="Customer *"
          options={customerOptions}
          value={watch("customerId")}
          onValueChange={(v) => setValue("customerId", v)}
          error={errors.customerId?.message}
          placeholder="Select customer..."
        />
        <GlassSelect
          label="Status"
          options={statusOptions}
          value={watch("status")}
          onValueChange={(v) => setValue("status", v as CreateOrderInput["status"])}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <GlassInput
          label="Shipping Fee"
          type="number"
          min={0}
          step={0.01}
          error={errors.shippingFee?.message}
          {...register("shippingFee", { valueAsNumber: true })}
        />
        <GlassInput
          label="Delivery Fee"
          type="number"
          min={0}
          step={0.01}
          error={errors.deliveryFee?.message}
          {...register("deliveryFee", { valueAsNumber: true })}
        />
        <GlassInput
          label="Cargo Fee"
          type="number"
          min={0}
          step={0.01}
          error={errors.cargoFee?.message}
          {...register("cargoFee", { valueAsNumber: true })}
        />
        <GlassInput
          label="Service Fee"
          type="number"
          min={0}
          step={0.01}
          error={errors.serviceFee?.message}
          {...register("serviceFee", { valueAsNumber: true })}
        />
      </div>

      <GlassInput
        label="Exchange Rate"
        type="number"
        min={0.0001}
        step={0.0001}
        error={errors.exchangeRate?.message}
        {...register("exchangeRate", { valueAsNumber: true })}
      />

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && <GlassButton type="button" variant="secondary" onClick={onCancel}>Cancel</GlassButton>}
        <GlassButton type="submit" loading={isLoading}>
          {defaultValues?.id ? "Save Changes" : "Create Order"}
        </GlassButton>
      </div>
    </form>
  );
}
