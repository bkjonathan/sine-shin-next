"use client";

import { useRef, useState } from "react";
import { FileText } from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";
import { CargoOrderInvoiceTemplate } from "@/components/cargo/CargoOrderInvoiceTemplate";
import { downloadDataUrl } from "@/utils/downloadImage";
import type { ShopSettings, CargoShipment, CargoItemWithLabels } from "@/types";

interface CargoOrderInvoiceButtonProps {
  shop: ShopSettings | null;
  shipment: Pick<CargoShipment, "cargoNo" | "carrierName" | "exchangeRate" | "createdAt">;
  orderDisplayId: string | null;
  customer: {
    name: string | null;
    customerId: string | null;
    phone: string | null;
    address: string | null;
  };
  items: CargoItemWithLabels[];
  exchangeCurrencyCode: string;
}

export function CargoOrderInvoiceButton({
  shop,
  shipment,
  orderDisplayId,
  customer,
  items,
  exchangeCurrencyCode,
}: CargoOrderInvoiceButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  async function handleDownload() {
    const el = invoiceRef.current;
    if (!el) return;
    setIsDownloading(true);
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
        width: 720,
        height: el.scrollHeight || 1000,
        style: {
          position: "static",
          left: "auto",
          top: "auto",
          opacity: "1",
        },
      });
      await downloadDataUrl(dataUrl, `cargo-receiving-invoice_${shipment.cargoNo}_${orderDisplayId ?? "order"}.png`);
    } finally {
      el.style.position = "fixed";
      el.style.left = "-9999px";
      el.style.top = "-9999px";
      el.style.zIndex = "";
      el.style.opacity = "";
      el.style.pointerEvents = "";
      setIsDownloading(false);
    }
  }

  return (
    <>
      <GlassButton
        variant="ghost"
        size="sm"
        onClick={handleDownload}
        loading={isDownloading}
        aria-label="Download receiving invoice"
        title="Download receiving invoice for this order"
      >
        <FileText className="h-3.5 w-3.5" />
      </GlassButton>
      <CargoOrderInvoiceTemplate
        ref={invoiceRef}
        shop={shop}
        shipment={shipment}
        orderDisplayId={orderDisplayId}
        customer={customer}
        items={items}
        exchangeCurrencyCode={exchangeCurrencyCode}
      />
    </>
  );
}
