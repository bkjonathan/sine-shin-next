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
          <label className="text-xs font-medium text-white/60">Platform</label>
          <select
            className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-[#007AFF]/50 focus:bg-white/[0.08]"
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
              <option key={p} value={p} className="bg-[#1a1a2e] text-white">{p}</option>
            ))}
          </select>
          {errors.platform && <p className="text-xs text-[#FF3B30]">{errors.platform.message}</p>}
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
