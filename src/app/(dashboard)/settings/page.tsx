"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSettings, useUpdateSettings, useChangePassword } from "@/hooks/use-settings";
import { updateSettingsSchema, changePasswordSchema, type UpdateSettingsInput, type ChangePasswordInput } from "@/validations/settings.schema";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassTextarea } from "@/components/ui/glass-textarea";
import { GlassButton } from "@/components/ui/glass-button";
import { PageHeader } from "@/components/layout/page-header";

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const changePassword = useChangePassword();

  const {
    register: regSettings,
    handleSubmit: handleSettings,
    reset: resetSettings,
    formState: { errors: settingsErrors },
  } = useForm<UpdateSettingsInput>({
    resolver: zodResolver(updateSettingsSchema),
    defaultValues: {
      shopName: "",
      phone: "",
      address: "",
      logoUrl: "",
      customerIdPrefix: "CUST",
      orderIdPrefix: "ORD",
    },
  });

  useEffect(() => {
    if (settings) {
      resetSettings({
        shopName: settings.shopName,
        phone: settings.phone ?? "",
        address: settings.address ?? "",
        logoUrl: settings.logoUrl ?? "",
        customerIdPrefix: settings.customerIdPrefix,
        orderIdPrefix: settings.orderIdPrefix,

      });
    }
  }, [settings, resetSettings]);

  const {
    register: regPassword,
    handleSubmit: handlePassword,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Settings" description="Manage your shop configuration" />

      {/* Shop info */}
      <GlassCard>
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-5">Shop Information</h3>
        <form onSubmit={handleSettings((d) => updateSettings.mutate(d))} className="space-y-4">
          <GlassInput label="Shop Name *" error={settingsErrors.shopName?.message} {...regSettings("shopName")} />
          <GlassInput label="Phone" {...regSettings("phone")} />
          <GlassTextarea label="Address" {...regSettings("address")} />
          <GlassInput label="Logo URL" placeholder="https://..." error={settingsErrors.logoUrl?.message} {...regSettings("logoUrl")} />
          <div className="grid grid-cols-2 gap-4">
            <GlassInput label="Customer ID Prefix" placeholder="CUST" error={settingsErrors.customerIdPrefix?.message} {...regSettings("customerIdPrefix")} />
            <GlassInput label="Order ID Prefix" placeholder="ORD" error={settingsErrors.orderIdPrefix?.message} {...regSettings("orderIdPrefix")} />
          </div>
          <div className="flex justify-end">
            <GlassButton type="submit" loading={updateSettings.isPending}>Save Settings</GlassButton>
          </div>
        </form>
      </GlassCard>

      {/* Change password */}
      <GlassCard>
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-5">Change Password</h3>
        <form
          onSubmit={handlePassword((d) => changePassword.mutate(d, { onSuccess: () => resetPassword() }))}
          className="space-y-4"
        >
          <GlassInput
            label="Current Password"
            type="password"
            error={passwordErrors.currentPassword?.message}
            {...regPassword("currentPassword")}
          />
          <GlassInput
            label="New Password"
            type="password"
            error={passwordErrors.newPassword?.message}
            {...regPassword("newPassword")}
          />
          <GlassInput
            label="Confirm New Password"
            type="password"
            error={passwordErrors.confirmPassword?.message}
            {...regPassword("confirmPassword")}
          />
          <div className="flex justify-end">
            <GlassButton type="submit" loading={changePassword.isPending}>Change Password</GlassButton>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
