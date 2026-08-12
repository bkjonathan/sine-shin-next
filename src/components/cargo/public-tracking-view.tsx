"use client";

import { useRef, useState } from "react";
import {
  Package, Printer, Download, Phone, MapPin, User, Plane, Calendar,
  Tag, Weight, StickyNote, Hash, Check, Copy, Truck,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { QrCode } from "@/components/ui/qr-code";
import { CargoShipmentLabel4x6Template } from "@/components/cargo/CargoShipmentLabel4x6Template";
import { CargoItemQrLabelTemplate } from "@/components/cargo/CargoItemQrLabelTemplate";
import { QR_LABEL_PRINT_OPTIONS, QR_LABEL_RENDER_OPTIONS } from "@/components/cargo/qr-label-print";
import { PublicTrackingHeader } from "@/components/cargo/public-tracking-header";
import { JOURNEY, STATUS_META } from "@/components/cargo/public-tracking-status";
import { renderNodeToPng, printImage } from "@/utils/labelImage";
import { downloadDataUrl } from "@/utils/downloadImage";
import { usePublicOrigin } from "@/hooks/use-public-origin";
import { trackingUrl } from "@/lib/tracking";
import { formatDate, cn } from "@/lib/utils";
import type { PublicCargoTrackingOpen, ShopSettings } from "@/types";

interface PublicTrackingViewProps {
  tracking: PublicCargoTrackingOpen;
  shop: ShopSettings | null;
}

type Action = "print4x6" | "printQr" | "downloadQr";

function DetailRow({
  icon: Icon,
  label,
  value,
  mono,
  href,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
  mono?: boolean;
  href?: string;
}) {
  const text = (
    <span className={cn("text-sm font-medium text-t1", mono && "font-mono", href && "underline decoration-line underline-offset-4")}>
      {value}
    </span>
  );
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-line bg-field">
        <Icon className="h-3.5 w-3.5 text-t3" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-t4">{label}</p>
        <p className="mt-1 break-words">
          {href ? <a href={href}>{text}</a> : text}
        </p>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <GlassCard padding="none" className={cn("p-5 sm:p-6", className)}>
      <h2 className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-t4">{title}</h2>
      <div className="mt-2 divide-y divide-divide">{children}</div>
    </GlassCard>
  );
}

export function PublicTrackingView({ tracking, shop }: PublicTrackingViewProps) {
  const [busy, setBusy] = useState<Action | null>(null);
  const [copied, setCopied] = useState(false);
  const origin = usePublicOrigin();
  const trackUrl = origin ? trackingUrl(tracking.publicCode, origin) : "";

  const qrRef = useRef<HTMLDivElement>(null);
  const shipment4x6Ref = useRef<HTMLDivElement>(null);

  const { customer } = tracking;
  const shopName = shop?.shopName ?? "Sine Shin Manager";
  const stageIndex = JOURNEY.indexOf(tracking.status);

  // The 4×6 label carries the whole consignment for this order; the categories
  // list is a single entry here because a tracking code addresses one item.
  const categoryNames = tracking.categoryName ? [tracking.categoryName] : [];

  async function run(action: Action, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(action);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  const printShipmentLabel = () =>
    run("print4x6", async () => {
      const el = shipment4x6Ref.current;
      if (!el) return;
      const dataUrl = await renderNodeToPng(el, { width: 384, height: 576, pixelRatio: 3 });
      await printImage(dataUrl, { width: "4in", height: "6in", alt: "Shipment label" });
    });

  const printQrLabel = () =>
    run("printQr", async () => {
      const el = qrRef.current;
      if (!el) return;
      const dataUrl = await renderNodeToPng(el, QR_LABEL_RENDER_OPTIONS);
      await printImage(dataUrl, QR_LABEL_PRINT_OPTIONS);
    });

  const downloadQrLabel = () =>
    run("downloadQr", async () => {
      const el = qrRef.current;
      if (!el) return;
      const dataUrl = await renderNodeToPng(el, QR_LABEL_RENDER_OPTIONS);
      await downloadDataUrl(dataUrl, `cargo-qr-label_${tracking.cargoNo}_${tracking.publicCode}.png`);
    });

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(tracking.publicCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable (insecure origin) — the code is on screen anyway */
    }
  }

  return (
    <div className="min-h-dvh bg-page">
      <PublicTrackingHeader shop={shop} status={tracking.status} />

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5 sm:px-6 sm:py-8">
        {/* ── Hero: what parcel is this ── */}
        <GlassCard padding="none" className="p-5 sm:p-7">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-t4">Cargo No</p>
              <p className="mt-1.5 font-mono text-3xl font-bold tracking-tight text-t1 sm:text-4xl">
                {tracking.cargoNo}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
                <div>
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-t4">Weight</p>
                  <p className="mt-0.5 flex items-baseline gap-1 text-xl font-semibold text-t1">
                    {tracking.weightKg.toFixed(2)}
                    <span className="text-xs font-medium text-t3">kg</span>
                  </p>
                </div>
                {tracking.orderDisplayId && (
                  <div>
                    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-t4">Order No</p>
                    <p className="mt-0.5 font-mono text-xl font-semibold text-t1">{tracking.orderDisplayId}</p>
                  </div>
                )}
                {tracking.bagLabel && (
                  <div>
                    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-t4">Bag</p>
                    <p className="mt-0.5 inline-flex items-center gap-1.5 text-xl font-semibold text-t1">
                      <Tag className="h-4 w-4 text-accent" />
                      {tracking.bagLabel}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Re-scannable QR, so this page can hand the parcel on to the next person */}
            <div className="flex shrink-0 flex-col items-start gap-2.5 sm:items-end">
              <div className="rounded-2xl border border-line bg-white p-2.5">
                <QrCode value={trackUrl} size={96} />
              </div>
              <button
                type="button"
                onClick={copyCode}
                className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 font-mono text-xs tracking-[0.08em] text-t3 transition-colors hover:bg-surface-hover hover:text-t1"
                title="Copy tracking code"
              >
                {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                {tracking.publicCode}
              </button>
            </div>
          </div>

          {/* ── Progress ── */}
          {stageIndex >= 0 ? (
            <div className="mt-7 border-t border-divide pt-5">
              <div className="flex items-center">
                {JOURNEY.map((stage, i) => {
                  const done = i <= stageIndex;
                  return (
                    <div key={stage} className="flex flex-1 items-center last:flex-none">
                      <div className="flex flex-col items-center gap-1.5">
                        <span
                          className={cn(
                            "h-2.5 w-2.5 rounded-full transition-colors",
                            done ? "bg-accent" : "bg-line"
                          )}
                        />
                        <span
                          className={cn(
                            "whitespace-nowrap text-[0.6rem] font-semibold uppercase tracking-wider",
                            done ? "text-t2" : "text-t4"
                          )}
                        >
                          {STATUS_META[stage].label}
                        </span>
                      </div>
                      {i < JOURNEY.length - 1 && (
                        <span className={cn("mb-5 h-px flex-1", i < stageIndex ? "bg-accent" : "bg-line")} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-7 border-t border-divide pt-5">
              <p className="text-sm text-danger">This shipment was cancelled.</p>
            </div>
          )}
        </GlassCard>

        {/* ── Print actions ── */}
        <GlassCard padding="none" className="p-5 sm:p-6">
          <h2 className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-t4">Labels</h2>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <GlassButton size="sm" loading={busy === "print4x6"} onClick={printShipmentLabel}>
              <Printer className="h-3.5 w-3.5" /> Print shipment label 4×6
            </GlassButton>
            <GlassButton variant="secondary" size="sm" loading={busy === "printQr"} onClick={printQrLabel}>
              <Printer className="h-3.5 w-3.5" /> Print QR label 35×25
            </GlassButton>
            <GlassButton variant="secondary" size="sm" loading={busy === "downloadQr"} onClick={downloadQrLabel}>
              <Download className="h-3.5 w-3.5" /> Download QR label
            </GlassButton>
          </div>
          <p className="mt-3 text-xs leading-5 text-t3">
            Labels print at their exact physical size — pick the matching paper in the print dialog and set scaling to
            100%.
          </p>
        </GlassCard>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* ── Consignee ── */}
          <SectionCard title="Consignee">
            <DetailRow icon={User} label="Name" value={customer.name ?? "—"} />
            {customer.phone && (
              <DetailRow icon={Phone} label="Phone" value={customer.phone} href={`tel:${customer.phone}`} />
            )}
            {customer.city && <DetailRow icon={MapPin} label="City" value={customer.city} />}
            {customer.address && <DetailRow icon={MapPin} label="Address" value={customer.address} />}
            {customer.customerId && <DetailRow icon={Hash} label="Customer ID" value={customer.customerId} mono />}
          </SectionCard>

          {/* ── Shipment ── */}
          <SectionCard title="Shipment">
            {tracking.carrierName && <DetailRow icon={Truck} label="Carrier" value={tracking.carrierName} />}
            {tracking.flightNumber && <DetailRow icon={Plane} label="Flight" value={tracking.flightNumber} mono />}
            <DetailRow icon={Calendar} label="Departure" value={formatDate(tracking.departureDate)} />
            <DetailRow icon={Calendar} label="Arrival" value={formatDate(tracking.arrivalDate)} />
            {tracking.categoryName && <DetailRow icon={Package} label="Category" value={tracking.categoryName} />}
            <DetailRow icon={Weight} label="Weight" value={`${tracking.weightKg.toFixed(2)} kg`} />
          </SectionCard>
        </div>

        {/* ── Handling note ── */}
        {tracking.note && (
          <GlassCard padding="none" className="p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-t4">
              <StickyNote className="h-3.5 w-3.5" /> Note
            </h2>
            <p className="mt-2.5 whitespace-pre-wrap text-sm leading-6 text-t1">{tracking.note}</p>
          </GlassCard>
        )}

        <p className="pt-2 pb-6 text-center text-xs text-t4">
          {shopName} · Tracking code <span className="font-mono">{tracking.publicCode}</span>
        </p>
      </main>

      {/* Off-screen templates rasterised on demand */}
      <CargoShipmentLabel4x6Template
        ref={shipment4x6Ref}
        shop={shop}
        shipment={{ cargoNo: tracking.cargoNo }}
        orderDisplayId={tracking.orderDisplayId}
        categoryNames={categoryNames}
        totalWeight={tracking.weightKg}
        note={tracking.note}
        customer={customer}
      />
      <CargoItemQrLabelTemplate
        ref={qrRef}
        shop={shop}
        shipment={{ cargoNo: tracking.cargoNo }}
        trackingUrl={trackUrl}
        publicCode={tracking.publicCode}
        orderDisplayId={tracking.orderDisplayId}
        customerName={customer.name}
        bagLabel={tracking.bagLabel}
        weightKg={tracking.weightKg}
      />
    </div>
  );
}
