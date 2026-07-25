"use client";

import { useRef, useState } from "react";
import { PackageSearch } from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";
import { CargoShipmentLabelTemplate } from "@/components/cargo/CargoShipmentLabelTemplate";
import type { ShopSettings, CargoShipment } from "@/types";

interface CargoShipmentLabelButtonProps {
  shop: ShopSettings | null;
  shipment: Pick<CargoShipment, "cargoNo" | "carrierName" | "carrierPhone" | "flightNumber" | "status">;
  orderDisplayId: string | null;
  categoryNames: string[];
  totalWeight: number;
}

export function CargoShipmentLabelButton({
  shop,
  shipment,
  orderDisplayId,
  categoryNames,
  totalWeight,
}: CargoShipmentLabelButtonProps) {
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
      const link = document.createElement("a");
      link.download = `shipment-label_${shipment.cargoNo}_${orderDisplayId ?? "order"}.png`;
      link.href = dataUrl;
      link.click();
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
        aria-label="Download shipment details label"
        title="Download shipment details label"
      >
        <PackageSearch className="h-3.5 w-3.5" />
      </GlassButton>
      <CargoShipmentLabelTemplate
        ref={labelRef}
        shop={shop}
        shipment={shipment}
        orderDisplayId={orderDisplayId}
        categoryNames={categoryNames}
        totalWeight={totalWeight}
      />
    </>
  );
}
