"use client";

import { useRef, useState } from "react";
import { IdCard } from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";
import { CargoCustomerLabelTemplate } from "@/components/cargo/CargoCustomerLabelTemplate";
import { downloadDataUrl } from "@/utils/downloadImage";
import type { ShopSettings, CargoShipment } from "@/types";

interface CargoCustomerLabelButtonProps {
  shop: ShopSettings | null;
  shipment: Pick<CargoShipment, "cargoNo">;
  orderDisplayId: string | null;
  customer: {
    name: string | null;
    customerId: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
  };
}

export function CargoCustomerLabelButton({
  shop,
  shipment,
  orderDisplayId,
  customer,
}: CargoCustomerLabelButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const labelRef = useRef<HTMLDivElement>(null);

  async function handleDownload() {
    const el = labelRef.current;
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
        width: 520,
        height: el.scrollHeight || 700,
        style: {
          position: "static",
          left: "auto",
          top: "auto",
          opacity: "1",
        },
      });
      await downloadDataUrl(dataUrl, `customer-label_${shipment.cargoNo}_${orderDisplayId ?? "order"}.png`);
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
        aria-label="Download customer shipping label"
        title="Download customer shipping label"
      >
        <IdCard className="h-3.5 w-3.5" />
      </GlassButton>
      <CargoCustomerLabelTemplate
        ref={labelRef}
        shop={shop}
        shipment={shipment}
        customer={customer}
      />
    </>
  );
}
