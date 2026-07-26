"use client";

import { useRef, useState } from "react";
import { Receipt } from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";
import { CargoPaymentReceiptTemplate } from "@/components/cargo/CargoPaymentReceiptTemplate";
import { formatDate } from "@/lib/utils";
import { downloadDataUrl } from "@/utils/downloadImage";
import type { ShopSettings } from "@/types";
import type { CargoPartyType } from "@/validations/cargo.schema";

interface CargoPaymentReceiptButtonProps {
  shop: ShopSettings | null;
  cargoNo: string;
  partyType: CargoPartyType;
  partyName: string | null;
  amount: number;
  currency: string;
  paidAt: string;
  method?: string | null;
  note?: string | null;
}

export function CargoPaymentReceiptButton({
  shop,
  cargoNo,
  partyType,
  partyName,
  amount,
  currency,
  paidAt,
  method,
  note,
}: CargoPaymentReceiptButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  async function handleDownload() {
    const el = receiptRef.current;
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
        width: 480,
        height: el.scrollHeight || 900,
        style: {
          position: "static",
          left: "auto",
          top: "auto",
          opacity: "1",
        },
      });
      await downloadDataUrl(dataUrl, `${partyType}-payment_${cargoNo}.png`);
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
        aria-label="Download payment receipt"
      >
        <Receipt className="h-3.5 w-3.5" />
      </GlassButton>
      <CargoPaymentReceiptTemplate
        ref={receiptRef}
        shop={shop}
        cargoNo={cargoNo}
        partyType={partyType}
        partyName={partyName}
        amountLabel={`${amount.toLocaleString()} ${currency}`}
        paidDate={formatDate(paidAt)}
        method={method}
        note={note}
      />
    </>
  );
}
