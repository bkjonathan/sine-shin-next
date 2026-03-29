"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
  USER_ROLES,
} from "@/validations/user.schema";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassButton } from "@/components/ui/glass-button";
import { Eye, EyeOff } from "lucide-react";
import { z } from "zod";

interface UserFormProps {
  defaultValues?: { id?: string; username?: string; role?: string };
  onSubmit: (data: CreateUserInput | UpdateUserInput) => void;
  isLoading?: boolean;
  onCancel?: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
};

// For editing, password is optional (leave blank to keep existing)
const editUserSchema = z.object({
  username: z
    .string()
    .min(1, "Username is required")
    .max(100, "Username must be at most 100 characters")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Only letters, numbers, dots, hyphens, underscores"),
  password: z
    .string()
    .max(128, "Password must be at most 128 characters")
    .optional()
    .or(z.literal("")),
  role: z.enum(USER_ROLES),
});

type EditUserFormData = z.infer<typeof editUserSchema>;

export function UserForm({ defaultValues, onSubmit, isLoading, onCancel }: UserFormProps) {
  const isEditing = !!defaultValues?.id;
  const [showPassword, setShowPassword] = useState(false);

  const schema = isEditing ? editUserSchema : createUserSchema;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateUserInput | EditUserFormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      username: defaultValues?.username ?? "",
      password: "",
      role: (defaultValues?.role as CreateUserInput["role"]) ?? "staff",
    },
  });

  const onFormSubmit = (data: CreateUserInput | EditUserFormData) => {
    if (isEditing) {
      const payload: UpdateUserInput = {};
      if (data.username && data.username !== defaultValues?.username) payload.username = data.username;
      if (data.password && data.password.length > 0) payload.password = data.password;
      if (data.role && data.role !== defaultValues?.role) payload.role = data.role;
      onSubmit(payload);
    } else {
      onSubmit(data as CreateUserInput);
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit as never)} className="space-y-4">
      <GlassInput
        label="Username *"
        placeholder="johndoe"
        autoComplete="username"
        error={errors.username?.message}
        {...register("username")}
      />

      <div className="relative">
        <GlassInput
          label={isEditing ? "New Password (leave blank to keep)" : "Password *"}
          type={showPassword ? "text" : "password"}
          placeholder={isEditing ? "••••••••" : "Min 6 characters"}
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <button
          type="button"
          onClick={() => setShowPassword((s) => !s)}
          className="absolute right-3 top-[2.1rem] rounded-lg p-1.5 text-t3 transition-colors hover:bg-surface hover:text-t1"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-t3">Role *</label>
        <select
          className="w-full rounded-2xl border border-line bg-field px-3 py-3 text-sm text-t1 outline-none transition-all duration-200 focus:border-accent-border focus:bg-panel"
          {...register("role")}
        >
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        {errors.role && <p className="text-xs text-danger">{errors.role.message}</p>}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <GlassButton type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </GlassButton>
        )}
        <GlassButton type="submit" loading={isLoading}>
          {isEditing ? "Save Changes" : "Create User"}
        </GlassButton>
      </div>
    </form>
  );
}
