import { Truck } from "lucide-react";
import { STATUS_META } from "@/components/cargo/public-tracking-status";
import { cn } from "@/lib/utils";
import type { CargoStatus, ShopSettings } from "@/types";

/** Shop identity + status chip, shared by the open and closed tracking pages. */
export function PublicTrackingHeader({
  shop,
  status,
}: {
  shop: ShopSettings | null;
  status: CargoStatus;
}) {
  const meta = STATUS_META[status] ?? STATUS_META.pending;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-topbar backdrop-blur-2xl">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3.5 sm:px-6">
        {shop?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg object-contain" />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-field">
            <Truck className="h-4 w-4 text-accent" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-t1">{shop?.shopName ?? "Sine Shin Manager"}</p>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-t4">Shipment Label</p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider",
            meta.className
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
          {meta.label}
        </span>
      </div>
    </header>
  );
}
