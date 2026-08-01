"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassSelect } from "@/components/ui/glass-select";
import { PageHeader } from "@/components/layout/page-header";
import { CargoStatusBadge } from "@/components/cargo/cargo-status-badge";
import { CargoItemsSection } from "@/components/cargo/cargo-items-section";
import { CargoPaymentsSection } from "@/components/cargo/cargo-payments-section";
import { CargoDetailActions } from "@/components/cargo/cargo-detail-actions";
import { CargoInvoiceTemplate } from "@/components/cargo/CargoInvoiceTemplate";
import { GlassButton } from "@/components/ui/glass-button";
import { useUpdateCargoShipment } from "@/hooks/use-cargo";
import { useCurrencyPrefs } from "@/hooks/use-currency-prefs";
import { calculateCargoShipmentSummary } from "@/utils/cargoCalculations";
import { downloadDataUrl } from "@/utils/downloadImage";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { CARGO_STATUSES } from "@/validations/cargo.schema";
import type { CargoShipmentWithDetails, ShopSettings } from "@/types";
import {
  ArrowLeft, Weight, CircleDollarSign, TrendingUp, Package,
  User, Phone, Plane, Calendar, ArrowRightLeft, Loader2, Pencil, Download,
} from "lucide-react";

interface CargoDetailClientProps {
  shipment: CargoShipmentWithDetails;
  shop: ShopSettings | null;
}

function InlineText({
  value,
  displayValue,
  onSave,
  type = "text",
  step,
  min,
  className,
}: {
  value: string | number;
  displayValue?: React.ReactNode;
  onSave: (v: string) => void;
  type?: "text" | "number" | "date";
  step?: string;
  min?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on enter-edit only. Keying a draft reset on `value` here would wipe
  // the user's keystrokes whenever the parent re-renders mid-edit.
  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [editing]);

  function startEditing() {
    setDraft(String(value));
    setEditing(true);
  }

  function commit() {
    if (draft !== String(value)) onSave(draft);
    setEditing(false);
  }

  function cancel() {
    setDraft(String(value));
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        step={step}
        min={min}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        onBlur={commit}
        className={cn(
          "rounded-xl border border-accent-border bg-field px-2 py-1 text-sm text-t1 outline-none",
          "ring-2 ring-accent-bg/60 transition-all",
          type === "number" && "w-24 text-right font-mono",
          type === "date" && "w-36",
          className
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className={cn(
        "group/inline relative inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 -mx-1.5 transition-all",
        "hover:bg-accent-bg/40 cursor-pointer",
        className
      )}
    >
      <span>{displayValue ?? String(value)}</span>
      <Pencil className="h-2.5 w-2.5 text-t4 opacity-0 transition-opacity group-hover/inline:opacity-100" />
    </button>
  );
}

const statusOptions = CARGO_STATUSES.map((s) => ({
  value: s,
  label: s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
}));

export function CargoDetailClient({ shipment: initialShipment, shop }: CargoDetailClientProps) {
  const router = useRouter();
  const updateShipment = useUpdateCargoShipment();
  const { prefs } = useCurrencyPrefs();
  const [shipment, setShipment] = useState(initialShipment);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

  useEffect(() => { setShipment(initialShipment); }, [initialShipment]);

  async function handleDownloadInvoice() {
    const el = invoiceRef.current;
    if (!el) return;
    setIsDownloadingInvoice(true);
    try {
      el.style.position = "absolute";
      el.style.left = "0";
      el.style.top = "0";
      el.style.zIndex = "-9999";
      el.style.opacity = "0";
      el.style.pointerEvents = "none";

      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 300));

      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        skipFonts: true,
        width: 920,
        height: el.scrollHeight || 1200,
        style: {
          position: "static",
          left: "auto",
          top: "auto",
          opacity: "1",
        },
      });
      await downloadDataUrl(dataUrl, `cargo-invoice_${shipment.cargoNo}.png`);
    } finally {
      el.style.position = "fixed";
      el.style.left = "-9999px";
      el.style.top = "-9999px";
      el.style.zIndex = "";
      el.style.opacity = "";
      el.style.pointerEvents = "";
      setIsDownloadingInvoice(false);
    }
  }

  const save = useCallback(
    (patch: Record<string, unknown>) => {
      setShipment((prev) => ({ ...prev, ...patch }) as CargoShipmentWithDetails);
      updateShipment.mutate(
        { id: shipment.id, ...patch },
        {
          onSuccess: () => router.refresh(),
          onError: () => setShipment(initialShipment),
        }
      );
    },
    [shipment.id, initialShipment, updateShipment, router]
  );

  const summary = calculateCargoShipmentSummary(shipment.items, shipment.payments, shipment.exchangeRate, prefs.currencyCode);
  const carrierPayments = shipment.payments.filter((p) => p.partyType === "carrier");
  const receiverPayments = shipment.payments.filter((p) => p.partyType === "receiver");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/cargo"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-t3 transition-all hover:-translate-y-0.5 hover:text-t1 hover:border-line-strong hover:[box-shadow:var(--shadow-card)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader
          title={shipment.cargoNo}
          description={`Created ${formatDate(shipment.createdAt)}`}
          actions={
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <CargoStatusBadge status={shipment.status} />
              <GlassButton variant="ghost" size="sm" onClick={handleDownloadInvoice} loading={isDownloadingInvoice}>
                <Download className="h-3.5 w-3.5" />
                <span className="text-xs">Invoice</span>
              </GlassButton>
              <CargoDetailActions cargoShipmentId={shipment.id} />
            </div>
          }
          className="mb-0 flex-1"
        />
      </div>

      {/* Status selector */}
      <GlassCard className="overflow-x-auto">
        <div className="w-48">
          <GlassSelect
            label="Status"
            options={statusOptions}
            value={shipment.status}
            onValueChange={(v) => save({ status: v })}
          />
        </div>
      </GlassCard>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
        <GlassCard padding="sm" hover>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(175,130,255,0.12)] text-[rgb(175,130,255)]">
              <Weight className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-t4">Weight</p>
              <p className="text-lg font-bold text-t1">{summary.totalWeight.toFixed(2)} kg</p>
              <p className="text-[10px] text-t4">{shipment.items.length} item{shipment.items.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard padding="sm" hover>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(255,176,32,0.12)] text-warning">
              <CircleDollarSign className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-t4">Carrier Owed</p>
              <p className="text-lg font-bold text-t1">{formatCurrency(summary.carrierOwed, prefs.currencySymbol)}</p>
              <p className="text-[10px] text-t4">Balance {formatCurrency(summary.carrierBalance, prefs.currencySymbol)}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard padding="sm" hover>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(50,184,255,0.12)] text-info">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-t4">Receiver Owed</p>
              <p className="text-lg font-bold text-t1">{formatCurrency(summary.receiverOwed, prefs.currencySymbol)}</p>
              <p className="text-[10px] text-t4">Balance {formatCurrency(summary.receiverBalance, prefs.currencySymbol)}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard padding="sm" hover>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(49,201,126,0.12)] text-success">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-t4">Profit</p>
              <p className={cn("text-lg font-bold", summary.profit >= 0 ? "text-success" : "text-danger")}>
                {formatCurrency(summary.profit, prefs.currencySymbol)}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          <GlassCard>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-t3">Cargo Items</h3>
              <span className="rounded-full bg-surface-hover px-2.5 py-0.5 text-xs font-medium text-t3">
                {shipment.items.length} item{shipment.items.length !== 1 ? "s" : ""}
              </span>
            </div>
            <CargoItemsSection cargoShipmentId={shipment.id} items={shipment.items} shop={shop} shipment={shipment} />
          </GlassCard>

          <CargoPaymentsSection
            cargoShipmentId={shipment.id}
            cargoNo={shipment.cargoNo}
            carrierName={shipment.carrierName}
            shop={shop}
            partyType="carrier"
            payments={carrierPayments}
            owed={summary.carrierOwed}
            paid={summary.carrierPaid}
            shipmentExchangeRate={shipment.exchangeRate}
            baseCurrencySymbol={prefs.currencySymbol}
            baseCurrencyCode={prefs.currencyCode}
          />

          <CargoPaymentsSection
            cargoShipmentId={shipment.id}
            cargoNo={shipment.cargoNo}
            carrierName={shipment.carrierName}
            shop={shop}
            partyType="receiver"
            payments={receiverPayments}
            owed={summary.receiverOwed}
            paid={summary.receiverPaid}
            shipmentExchangeRate={shipment.exchangeRate}
            baseCurrencySymbol={prefs.currencySymbol}
            baseCurrencyCode={prefs.currencyCode}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <GlassCard>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-t3">Carrier</h3>
            <dl className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-hover text-t3">
                  <User className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <dt className="text-[10px] font-medium uppercase tracking-wider text-t4">Name</dt>
                  <dd>
                    <InlineText
                      value={shipment.carrierName ?? ""}
                      displayValue={<span className="text-sm text-t1">{shipment.carrierName || "—"}</span>}
                      onSave={(v) => save({ carrierName: v || null })}
                    />
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-hover text-t3">
                  <Phone className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <dt className="text-[10px] font-medium uppercase tracking-wider text-t4">Phone</dt>
                  <dd>
                    <InlineText
                      value={shipment.carrierPhone ?? ""}
                      displayValue={<span className="text-sm text-t1">{shipment.carrierPhone || "—"}</span>}
                      onSave={(v) => save({ carrierPhone: v || null })}
                    />
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-hover text-t3">
                  <Plane className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <dt className="text-[10px] font-medium uppercase tracking-wider text-t4">Flight Number</dt>
                  <dd>
                    <InlineText
                      value={shipment.flightNumber ?? ""}
                      displayValue={<span className="text-sm text-t1">{shipment.flightNumber || "—"}</span>}
                      onSave={(v) => save({ flightNumber: v || null })}
                    />
                  </dd>
                </div>
              </div>
            </dl>
          </GlassCard>

          <GlassCard>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-t3">Schedule &amp; Rate</h3>
            <dl className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-hover text-t3">
                  <Calendar className="h-3.5 w-3.5" />
                </div>
                <div>
                  <dt className="text-[10px] font-medium uppercase tracking-wider text-t4">Departure Date</dt>
                  <dd>
                    <InlineText
                      value={shipment.departureDate ?? ""}
                      displayValue={<span className="text-sm text-t1">{shipment.departureDate ? formatDate(shipment.departureDate) : "—"}</span>}
                      type="date"
                      onSave={(v) => save({ departureDate: v || null })}
                    />
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-hover text-t3">
                  <Calendar className="h-3.5 w-3.5" />
                </div>
                <div>
                  <dt className="text-[10px] font-medium uppercase tracking-wider text-t4">Arrival Date</dt>
                  <dd>
                    <InlineText
                      value={shipment.arrivalDate ?? ""}
                      displayValue={<span className="text-sm text-t1">{shipment.arrivalDate ? formatDate(shipment.arrivalDate) : "—"}</span>}
                      type="date"
                      onSave={(v) => save({ arrivalDate: v || null })}
                    />
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-hover text-t3">
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                </div>
                <div>
                  <dt className="text-[10px] font-medium uppercase tracking-wider text-t4">Exchange Rate</dt>
                  <dd>
                    <InlineText
                      value={shipment.exchangeRate}
                      displayValue={<span className="font-mono text-sm text-t1">{shipment.exchangeRate.toFixed(4)}</span>}
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      onSave={(v) => save({ exchangeRate: parseFloat(v) || shipment.exchangeRate })}
                    />
                  </dd>
                </div>
              </div>
            </dl>
          </GlassCard>

          <GlassCard>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-t3">Notes</h3>
            <InlineText
              value={shipment.notes ?? ""}
              displayValue={<span className="text-sm text-t2 whitespace-pre-wrap">{shipment.notes || "No notes"}</span>}
              onSave={(v) => save({ notes: v || null })}
              className="w-full"
            />
          </GlassCard>
        </div>
      </div>

      {updateShipment.isPending && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-2.5 shadow-[var(--shadow-card)] backdrop-blur-xl">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          <span className="text-sm text-t2">Saving...</span>
        </div>
      )}

      {/* ── Hidden invoice template (off-screen, captured by html-to-image) ── */}
      <CargoInvoiceTemplate
        ref={invoiceRef}
        shop={shop}
        shipment={shipment}
        items={shipment.items}
        totalWeight={summary.totalWeight}
        receiverOwed={summary.receiverOwed}
        totalWithExchange={summary.receiverOwed * shipment.exchangeRate}
        exchangeCurrencyCode={prefs.exchangeCurrencyCode}
      />
    </div>
  );
}
