"use client";

import { Lock } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { useHasRole } from "@/hooks/use-role";
import type { Role } from "@/lib/roles";

/**
 * Renders `children` only for `min` and above, so a page's data hooks never
 * call an API that would refuse this role. The API check is the access
 * control; this only avoids a page of errors (AUDIT.md F-12).
 */
export function RequireRole({ min, children }: { min: Role; children: React.ReactNode }) {
  const allowed = useHasRole(min);
  if (allowed) return <>{children}</>;

  return (
    <GlassCard className="flex flex-col items-center py-16 text-center">
      <Lock className="mb-3 h-6 w-6 text-t3" />
      <p className="text-sm font-medium text-t1">Not available for your role</p>
      <p className="mt-1 text-xs text-t3">Ask the shop owner if you need access to this page.</p>
    </GlassCard>
  );
}
