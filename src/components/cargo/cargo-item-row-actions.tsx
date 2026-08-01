"use client";

import { useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal, FileText, IdCard, Printer, PackageSearch, Trash2 } from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";
import { CargoOrderInvoiceTemplate } from "@/components/cargo/CargoOrderInvoiceTemplate";
import { CargoCustomerLabelTemplate } from "@/components/cargo/CargoCustomerLabelTemplate";
import { CargoCustomerLabel4x6Template } from "@/components/cargo/CargoCustomerLabel4x6Template";
import { CargoShipmentLabelTemplate } from "@/components/cargo/CargoShipmentLabelTemplate";
import { CargoShipmentLabel4x6Template } from "@/components/cargo/CargoShipmentLabel4x6Template";
import { downloadDataUrl } from "@/utils/downloadImage";
import { renderNodeToPng, printImage } from "@/utils/labelImage";
import { cn } from "@/lib/utils";
import type { ShopSettings, CargoShipment, CargoItemWithLabels } from "@/types";

interface Customer {
  name: string | null;
  customerId: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
}

interface CargoItemRowActionsProps {
  shop: ShopSettings | null;
  shipment: Pick<CargoShipment, "cargoNo" | "carrierName" | "exchangeRate" | "createdAt">;
  orderDisplayId: string | null;
  note: string | null;
  customer: Customer;
  invoiceItems: CargoItemWithLabels[];
  exchangeCurrencyCode: string;
  categoryNames: string[];
  totalWeight: number;
  onRemove: () => void;
}

type Action = "invoice" | "customer" | "customer4x6" | "shipment" | "shipmentPrint";

export function CargoItemRowActions({
  shop,
  shipment,
  orderDisplayId,
  note,
  customer,
  invoiceItems,
  exchangeCurrencyCode,
  categoryNames,
  totalWeight,
  onRemove,
}: CargoItemRowActionsProps) {
  const [busy, setBusy] = useState<Action | null>(null);

  const invoiceRef = useRef<HTMLDivElement>(null);
  const customerRef = useRef<HTMLDivElement>(null);
  const customer4x6Ref = useRef<HTMLDivElement>(null);
  const shipmentRef = useRef<HTMLDivElement>(null);
  const shipment4x6Ref = useRef<HTMLDivElement>(null);

  const orderSuffix = orderDisplayId ?? "order";

  async function run(action: Action, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(action);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  const handleInvoice = () =>
    run("invoice", async () => {
      const el = invoiceRef.current;
      if (!el) return;
      const dataUrl = await renderNodeToPng(el, { width: 720 });
      await downloadDataUrl(dataUrl, `cargo-receiving-invoice_${shipment.cargoNo}_${orderSuffix}.png`);
    });

  const handleCustomer = () =>
    run("customer", async () => {
      const el = customerRef.current;
      if (!el) return;
      const dataUrl = await renderNodeToPng(el, { width: 520 });
      await downloadDataUrl(dataUrl, `customer-label_${shipment.cargoNo}_${orderSuffix}.png`);
    });

  const handleCustomer4x6 = () =>
    run("customer4x6", async () => {
      const el = customer4x6Ref.current;
      if (!el) return;
      const dataUrl = await renderNodeToPng(el, { width: 384, height: 576, pixelRatio: 3 });
      await printImage(dataUrl, {
        pageCss: `@page { size: 4in 6in; margin: 0; }`,
        imgCss: `width: 4in; height: 6in; display: block;`,
        alt: "Customer label",
      });
    });

  const handleShipment = () =>
    run("shipment", async () => {
      const el = shipmentRef.current;
      if (!el) return;
      const dataUrl = await renderNodeToPng(el, { width: 520 });
      await downloadDataUrl(dataUrl, `shipment-label_${shipment.cargoNo}_${orderSuffix}.png`);
    });

  const handleShipmentPrint = () =>
    run("shipmentPrint", async () => {
      const el = shipment4x6Ref.current;
      if (!el) return;
      const dataUrl = await renderNodeToPng(el, { width: 384, height: 576, pixelRatio: 3 });
      await printImage(dataUrl, {
        pageCss: `@page { size: 4in 6in; margin: 0; }`,
        imgCss: `width: 4in; height: 6in; display: block;`,
        alt: "Shipment label",
      });
    });

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <GlassButton
            variant="ghost"
            size="sm"
            loading={busy !== null}
            aria-label="Item actions"
            title="Item actions"
          >
            {busy === null && <MoreHorizontal className="h-4 w-4" />}
          </GlassButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-[220px] overflow-hidden rounded-2xl border border-line bg-panel p-1.5 backdrop-blur-2xl shadow-[var(--shadow-card)]"
          >
            <MenuItem icon={FileText} label="Receiving invoice" hint="Download PNG" onSelect={handleInvoice} />
            <MenuItem icon={IdCard} label="Customer label" hint="Download PNG" onSelect={handleCustomer} />
            <MenuItem icon={Printer} label="Customer label 4×6" hint="Print" onSelect={handleCustomer4x6} />
            <div className="my-1 h-px bg-line" />
            <MenuItem icon={PackageSearch} label="Shipment label" hint="Download PNG" onSelect={handleShipment} />
            <MenuItem icon={Printer} label="Shipment label" hint="Print" onSelect={handleShipmentPrint} />
            <div className="my-1 h-px bg-line" />
            <MenuItem icon={Trash2} label="Remove from shipment" destructive onSelect={onRemove} />
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Off-screen templates rasterised on demand */}
      <CargoOrderInvoiceTemplate
        ref={invoiceRef}
        shop={shop}
        shipment={shipment}
        orderDisplayId={orderDisplayId}
        customer={customer}
        items={invoiceItems}
        exchangeCurrencyCode={exchangeCurrencyCode}
      />
      <CargoCustomerLabelTemplate ref={customerRef} shop={shop} shipment={shipment} note={note} customer={customer} />
      <CargoCustomerLabel4x6Template
        ref={customer4x6Ref}
        shop={shop}
        shipment={shipment}
        orderDisplayId={orderDisplayId}
        note={note}
        customer={customer}
      />
      <CargoShipmentLabelTemplate
        ref={shipmentRef}
        shop={shop}
        shipment={shipment}
        orderDisplayId={orderDisplayId}
        categoryNames={categoryNames}
        totalWeight={totalWeight}
        note={note}
        customer={customer}
      />
      <CargoShipmentLabel4x6Template
        ref={shipment4x6Ref}
        shop={shop}
        shipment={shipment}
        orderDisplayId={orderDisplayId}
        categoryNames={categoryNames}
        totalWeight={totalWeight}
        note={note}
        customer={customer}
      />
    </>
  );
}

function MenuItem({
  icon: Icon,
  label,
  hint,
  destructive,
  onSelect,
}: {
  icon: typeof FileText;
  label: string;
  hint?: string;
  destructive?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      onSelect={() => onSelect()}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-none select-none",
        "data-[highlighted]:bg-surface-hover",
        destructive ? "text-danger data-[highlighted]:text-danger" : "text-t2 data-[highlighted]:text-t1"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {hint && <span className="text-xs text-t4">{hint}</span>}
    </DropdownMenu.Item>
  );
}
