"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassButton } from "@/components/ui/glass-button";
import { BarChart3, ShieldCheck, Sparkles, Store } from "lucide-react";

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
        <div className="rounded-2xl border border-[rgba(255,92,92,0.24)] bg-[rgba(255,92,92,0.12)] px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
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
    <main className="relative min-h-screen overflow-hidden bg-page">
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-float-slow absolute left-[8%] top-[12%] h-72 w-72 rounded-full blur-3xl" style={{ background: "var(--gradient-blob-1)" }} />
        <div className="animate-float-reverse absolute bottom-[8%] right-[10%] h-80 w-80 rounded-full blur-3xl" style={{ background: "var(--gradient-blob-2)" }} />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="order-2 lg:order-1">
            <div className="rounded-[32px] border border-line bg-surface p-6 shadow-[var(--shadow-card)] backdrop-blur-2xl sm:p-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent-border bg-accent-bg px-3 py-1.5 text-xs font-medium text-accent">
                <Sparkles className="h-3.5 w-3.5" />
                Shop operations cockpit
              </div>

              <div className="mt-6 max-w-2xl">
                <h1 className="text-4xl font-semibold tracking-tight text-t1 sm:text-5xl">
                  A sharper control room for your store.
                </h1>
                <p className="mt-4 text-sm leading-7 text-t2 sm:text-base">
                  Track customer growth, orders, expenses, and account health in a mobile-ready workspace with cleaner light mode and stronger visual hierarchy.
                </p>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {[
                  { icon: BarChart3, label: "Clear metrics", note: "Dashboards that stay readable in both themes." },
                  { icon: ShieldCheck, label: "Secure access", note: "One sign-in flow for the whole operations team." },
                  { icon: Store, label: "Built for mobile", note: "Responsive shell with drawer and bottom dock." },
                ].map(({ icon: Icon, label, note }) => (
                  <div key={label} className="rounded-[24px] border border-line bg-panel p-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-accent-border bg-accent-bg text-accent">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-t1">{label}</p>
                    <p className="mt-2 text-xs leading-6 text-t3">{note}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="order-1 w-full lg:order-2 lg:justify-self-end">
            <div className="mx-auto w-full max-w-md rounded-[32px] border border-line bg-panel p-6 shadow-[var(--shadow-card-hover)] backdrop-blur-3xl sm:p-8">
              <div className="text-center">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-[24px] border border-accent-border bg-accent-bg shadow-[0_18px_40px_var(--accent-shadow)]">
                  <Store className="h-8 w-8 text-accent" />
                </div>
                <h2 className="mt-5 text-3xl font-semibold tracking-tight text-t1">
                  Welcome back
                </h2>
                <p className="mt-2 text-sm text-t2">
                  Sign in to continue managing your shop.
                </p>
              </div>

              <div className="mt-8">
                <Suspense fallback={<div className="flex h-40 items-center justify-center text-sm text-t3">Loading...</div>}>
                  <LoginForm />
                </Suspense>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
