"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassButton } from "@/components/ui/glass-button";
import { Store } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});
type LoginInput = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginInput) {
    setError(null);
    const res = await signIn("credentials", {
      username: data.username,
      password: data.password,
      redirect: false,
    });

    if (res?.error) {
      setError("Invalid username or password");
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <GlassInput
        label="Username"
        placeholder="Enter your username"
        autoComplete="username"
        error={errors.username?.message}
        {...register("username")}
      />
      <GlassInput
        label="Password"
        type="password"
        placeholder="Enter your password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />

      {error && (
        <div className="rounded-xl px-4 py-3 bg-[#FF3B30]/10 border border-[#FF3B30]/20">
          <p className="text-sm text-[#FF3B30]">{error}</p>
        </div>
      )}

      <GlassButton type="submit" className="w-full mt-2" loading={isSubmitting}>
        Sign In
      </GlassButton>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0a0a0f]">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#007AFF]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/8 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-sm px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#007AFF]/20 border border-[#007AFF]/30 mb-4 shadow-[0_0_32px_rgba(0,122,255,0.2)]">
            <Store className="h-8 w-8 text-[#007AFF]" />
          </div>
          <h1 className="text-2xl font-bold text-white/90">Welcome back</h1>
          <p className="text-sm text-white/50 mt-1">Sign in to your shop manager</p>
        </div>

        {/* Glass card */}
        <div className="rounded-2xl border border-white/15 bg-white/[0.08] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.2)] p-6">
          <Suspense fallback={<div className="h-40 flex items-center justify-center text-white/40 text-sm">Loading…</div>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
