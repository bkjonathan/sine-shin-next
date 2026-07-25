"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCargoShipments, useCreateCargoShipment } from "@/hooks/use-cargo";
import { CargoTable } from "@/components/cargo/cargo-table";
import { PageHeader } from "@/components/layout/page-header";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassSelect } from "@/components/ui/glass-select";
import { GlassModal } from "@/components/ui/glass-modal";
import { CargoShipmentForm } from "@/components/cargo/cargo-shipment-form";
import { Plus } from "lucide-react";
import type { CreateCargoShipmentInput } from "@/validations/cargo.schema";
import { CARGO_STATUSES } from "@/validations/cargo.schema";
import { cn } from "@/lib/utils";

const PER_PAGE_OPTIONS = [
  { value: "10", label: "10" },
  { value: "20", label: "20" },
  { value: "50", label: "50" },
];

const STATUS_PILLS = ["all", ...CARGO_STATUSES] as const;

function statusLabel(s: string) {
  return s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export default function CargoPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [creating, setCreating] = useState(false);
  const createShipment = useCreateCargoShipment();

  const { data, isLoading } = useCargoShipments({ page, search, status, limit, sort: "createdAt", order: "desc" });

  const total = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.totalPages ?? 1;

  const handleSearch = (val: string) => { setSearch(val); setPage(1); };
  const handleStatus = (val: string) => { setStatus(val === "all" ? "" : val); setPage(1); };
  const handleLimit = (val: string) => { setLimit(Number(val)); setPage(1); };

  const activeStatus = status || "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cargo"
        description="Manage cargo shipments, carriers, and payments"
        actions={
          <GlassButton onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New Shipment
          </GlassButton>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1 relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-t3">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </span>
          <GlassInput
            placeholder="Search by cargo no. or carrier..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_PILLS.map((s) => (
          <button
            key={s}
            onClick={() => handleStatus(s)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
              activeStatus === s
                ? "bg-accent text-white shadow-[0_4px_14px_var(--accent-shadow)]"
                : "border border-line bg-surface text-t2 hover:bg-surface-hover hover:text-t1"
            )}
          >
            {s === "all" ? "All" : statusLabel(s)}
          </button>
        ))}
      </div>

      <CargoTable shipments={data?.data ?? []} isLoading={isLoading} />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-3.5">
        <span className="text-sm text-t2">{total} shipments</span>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-t2">
            Per page
            <div className="w-20">
              <GlassSelect value={String(limit)} onValueChange={handleLimit} options={PER_PAGE_OPTIONS} />
            </div>
          </div>
          <GlassButton variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </GlassButton>
          <span className="text-sm text-t2">Page {page} of {totalPages}</span>
          <GlassButton variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </GlassButton>
        </div>
      </div>

      <GlassModal open={creating} onOpenChange={setCreating} title="New Cargo Shipment" size="lg">
        <CargoShipmentForm
          onSubmit={(d: CreateCargoShipmentInput) =>
            createShipment.mutate(d, {
              onSuccess: (created) => {
                setCreating(false);
                router.push(`/cargo/${created.id}`);
              },
            })
          }
          isLoading={createShipment.isPending}
          onCancel={() => setCreating(false)}
        />
      </GlassModal>
    </div>
  );
}
