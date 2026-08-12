import { CircleCheckBig } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { PublicTrackingHeader } from "@/components/cargo/public-tracking-header";
import { formatDate } from "@/lib/utils";
import type { PublicCargoTrackingClosed, ShopSettings } from "@/types";

/**
 * What a scan shows once the parcel has been delivered.
 *
 * Deliberately a dead end: no consignee, no carrier, no note, and no label to
 * print. It confirms the delivery so a scanner knows the code was valid — a
 * bare 404 would be indistinguishable from a mistyped code — and stops there.
 */
export function PublicTrackingClosed({
  tracking,
  shop,
}: {
  tracking: PublicCargoTrackingClosed;
  shop: ShopSettings | null;
}) {
  return (
    <div className="min-h-dvh bg-page">
      <PublicTrackingHeader shop={shop} status={tracking.status} />

      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-12 sm:px-6 sm:py-20">
        <GlassCard padding="none" className="w-full max-w-md p-7 text-center sm:p-9">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(49,201,126,0.3)] bg-[rgba(49,201,126,0.14)]">
            <CircleCheckBig className="h-6 w-6 text-success" />
          </span>

          <h1 className="mt-5 text-xl font-semibold text-t1">Delivered</h1>
          <p className="mt-2.5 text-sm leading-6 text-t2">
            This parcel has been delivered. Its shipment details are no longer published here.
          </p>

          <div className="mt-6 space-y-3 border-t border-divide pt-5">
            <div>
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-t4">Cargo No</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-t1">{tracking.cargoNo}</p>
            </div>
            {tracking.arrivalDate && (
              <div>
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-t4">Arrived</p>
                <p className="mt-1 text-sm font-medium text-t1">{formatDate(tracking.arrivalDate)}</p>
              </div>
            )}
          </div>
        </GlassCard>

        <p className="mt-6 max-w-md text-center text-xs leading-5 text-t4">
          Need the details for this shipment? Contact {shop?.shopName ?? "the sender"} with cargo no{" "}
          <span className="font-mono">{tracking.cargoNo}</span>.
        </p>
      </main>
    </div>
  );
}
