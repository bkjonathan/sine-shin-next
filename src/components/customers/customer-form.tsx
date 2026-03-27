"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCustomerSchema, type CreateCustomerInput } from "@/validations/customer.schema";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassTextarea } from "@/components/ui/glass-textarea";
import { GlassButton } from "@/components/ui/glass-button";
import type { Customer } from "@/types";

const PLATFORMS = ["Facebook", "TikTok", "Others"] as const;

interface CustomerFormProps {
  defaultValues?: Partial<Customer>;
  onSubmit: (data: CreateCustomerInput) => void;
  isLoading?: boolean;
  onCancel?: () => void;
}

export function CustomerForm({ defaultValues, onSubmit, isLoading, onCancel }: CustomerFormProps) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<CreateCustomerInput>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      phone: defaultValues?.phone ?? "",
      city: defaultValues?.city ?? "",
      platform: defaultValues?.platform ?? undefined,
      socialMediaUrl: defaultValues?.socialMediaUrl ?? "",
      address: defaultValues?.address ?? "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <GlassInput
        label="Name *"
        placeholder="John Doe"
        error={errors.name?.message}
        {...register("name")}
      />
      <div className="grid grid-cols-2 gap-4">
        <GlassInput
          label="Phone"
          placeholder="0912345678"
          error={errors.phone?.message}
          {...register("phone")}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-t3">Platform</label>
          <select
            className="w-full rounded-2xl border border-line bg-field px-3 py-3 text-sm text-t1 outline-none transition-all duration-200 focus:border-accent-border focus:bg-[var(--bg-panel)]"
            {...register("platform", {
              onChange: (e) => {
                const prefixes: Record<string, string> = {
                  Facebook: "https://facebook.com/",
                  TikTok: "https://tiktok.com/@",
                  Others: "",
                };
                const prefix = prefixes[e.target.value] ?? "";
                const current = watch("socialMediaUrl") ?? "";
                // Only set prefix if field is empty or currently has another prefix
                const knownPrefixes = Object.values(prefixes).filter(Boolean);
                const hasPrefix = knownPrefixes.some((p) => current.startsWith(p));
                if (!current || hasPrefix) setValue("socialMediaUrl", prefix);
              },
            })}
          >
            <option value="">Select Platform</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          {errors.platform && <p className="text-xs text-danger">{errors.platform.message}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <GlassInput
          label="City"
          placeholder="Yangon"
          error={errors.city?.message}
          {...register("city")}
        />
        <GlassInput
          label="Social Media URL"
          placeholder="https://facebook.com/..."
          error={errors.socialMediaUrl?.message}
          {...register("socialMediaUrl")}
        />
      </div>
      <GlassTextarea
        label="Address"
        placeholder="Full address..."
        error={errors.address?.message}
        {...register("address")}
      />

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <GlassButton type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </GlassButton>
        )}
        <GlassButton type="submit" loading={isLoading}>
          {defaultValues?.id ? "Save Changes" : "Add Customer"}
        </GlassButton>
      </div>
    </form>
  );
}
