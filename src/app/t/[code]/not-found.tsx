import { PackageX } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

/**
 * Shown when a scanned code matches nothing — a mistyped code, or a parcel that
 * has since been removed from its shipment. Deliberately says nothing about
 * which of the two it was.
 */
export default function TrackingNotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-page px-4 py-12">
      <GlassCard padding="lg" className="w-full max-w-md text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-field">
          <PackageX className="h-6 w-6 text-t3" />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-t1">Label not found</h1>
        <p className="mt-2.5 text-sm leading-6 text-t2">
          This tracking code doesn&apos;t match any parcel. Check the code printed under the QR on the label, or ask the
          sender to re-issue it.
        </p>
      </GlassCard>
    </div>
  );
}
