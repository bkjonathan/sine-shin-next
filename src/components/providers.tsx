"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { getQueryClient } from "@/lib/query-client";
import { ThemeProvider, useTheme } from "@/contexts/theme-context";
import type { Session } from "next-auth";

interface ProvidersProps {
  children: React.ReactNode;
  session: Session | null;
}

function ThemedToaster() {
  const { mode } = useTheme();
  return (
    <Toaster
      position="bottom-right"
      theme={mode}
      toastOptions={{
        style: {
          background: mode === "dark" ? "rgba(20,20,28,0.9)" : "rgba(255,255,255,0.95)",
          backdropFilter: "blur(16px)",
          border: "1px solid var(--border)",
          color: "var(--text-1)",
        },
      }}
    />
  );
}

export function Providers({ children, session }: ProvidersProps) {
  const queryClient = getQueryClient();

  return (
    <ThemeProvider>
      <SessionProvider session={session}>
        <QueryClientProvider client={queryClient}>
          {children}
          <ThemedToaster />
        </QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
