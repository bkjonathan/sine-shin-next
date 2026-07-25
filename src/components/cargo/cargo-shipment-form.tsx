"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { createCargoShipmentSchema, CARGO_STATUSES, type CreateCargoShipmentInput } from "@/validations/cargo.schema";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassSelect } from "@/components/ui/glass-select";
import { GlassTextarea } from "@/components/ui/glass-textarea";
import { GlassButton } from "@/components/ui/glass-button";
import { useCurrencyPrefs } from "@/hooks/use-currency-prefs";
import type { CargoShipment } from "@/types";

interface CargoShipmentFormProps {
  defaultValues?: Partial<CargoShipment>;
  onSubmit: (data: CreateCargoShipmentInput) => void;
  isLoading?: boolean;
  onCancel?: () => void;
}

const statusOptions = CARGO_STATUSES.map((s) => ({
  value: s,
  label: s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
}));

export function CargoShipmentForm({ defaultValues, onSubmit, isLoading, onCancel }: CargoShipmentFormProps) {
  const { prefs } = useCurrencyPrefs();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<z.input<typeof createCargoShipmentSchema>, unknown, CreateCargoShipmentInput>({
    resolver: zodResolver(createCargoShipmentSchema),
    defaultValues: {
      carrierName: defaultValues?.carrierName ?? "",
      carrierPhone: defaultValues?.carrierPhone ?? "",
      flightNumber: defaultValues?.flightNumber ?? "",
      status: (defaultValues?.status as CreateCargoShipmentInput["status"]) ?? "pending",
      departureDate: defaultValues?.departureDate ?? "",
      arrivalDate: defaultValues?.arrivalDate ?? "",
      exchangeRate: defaultValues?.exchangeRate ?? prefs.exchangeRate,
      notes: defaultValues?.notes ?? "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-t1 mb-1">Carrier Information</h3>
        <hr className="border-accent mb-4" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <GlassInput label="Carrier Name" error={errors.carrierName?.message} {...register("carrierName")} />
          <GlassInput label="Carrier Phone" error={errors.carrierPhone?.message} {...register("carrierPhone")} />
          <GlassInput label="Flight / Flight Number" error={errors.flightNumber?.message} {...register("flightNumber")} />
          <GlassSelect
            label="Status"
            options={statusOptions}
            value={watch("status")}
            onValueChange={(v) => setValue("status", v as CreateCargoShipmentInput["status"])}
          />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-t1 mb-1">Schedule &amp; Exchange Rate</h3>
        <hr className="border-line mb-4" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <GlassInput label="Departure Date" type="date" error={errors.departureDate?.message} {...register("departureDate")} />
          <GlassInput label="Arrival Date" type="date" error={errors.arrivalDate?.message} {...register("arrivalDate")} />
          <GlassInput
            label="Exchange Rate"
            type="number"
            min={0.0001}
            step={0.0001}
            error={errors.exchangeRate?.message}
            {...register("exchangeRate", { valueAsNumber: true })}
          />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-t1 mb-1">Notes</h3>
        <hr className="border-line mb-4" />
        <GlassTextarea placeholder="Optional notes about this shipment..." {...register("notes")} />
      </section>

      <hr className="border-line" />
      <div className="flex justify-end gap-3 pt-2">
        {onCancel && <GlassButton type="button" variant="secondary" onClick={onCancel}>Cancel</GlassButton>}
        <GlassButton type="submit" loading={isLoading}>
          {defaultValues?.id ? "Save Changes" : "Create Shipment"}
        </GlassButton>
      </div>
    </form>
  );
}
