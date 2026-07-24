"use client";

import { useEffect, useRef, useState } from "react";
import { Receipt } from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";
import { PaymentReceivedTemplate } from "@/components/invoice/PaymentReceivedTemplate";
import { useOrder } from "@/hooks/use-orders";
import { useSettings } from "@/hooks/use-settings";
import { useCurrencyPrefs } from "@/hooks/use-currency-prefs";
import { calculateOrderTotals, formatPrice } from "@/utils/invoiceCalculations";
import { formatDate } from "@/lib/utils";

interface OrderPaymentReceiptButtonProps {
  orderId: string;
}

export function OrderPaymentReceiptButton({ orderId }: OrderPaymentReceiptButtonProps) {
  const [triggered, setTriggered] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  const { data: shop } = useSettings();
  const { prefs } = useCurrencyPrefs();
  const { data: fullOrder, isError } = useOrder(triggered ? orderId : undefined);

  useEffect(() => {
    if (isError) setIsDownloading(false);
  }, [isError]);

  useEffect(() => {
    if (!triggered || !fullOrder) return;
    let cancelled = false;

    (async () => {
      const el = receiptRef.current;
      if (!el) return;
      try {
        // Temporarily bring the element on-screen so the browser computes layout
        el.style.position = "absolute";
        el.style.left = "0";
        el.style.top = "0";
        el.style.zIndex = "-9999";
        el.style.opacity = "0";
        el.style.pointerEvents = "none";

        await document.fonts.ready;
        const images = el.querySelectorAll("img");
        await Promise.all(
          Array.from(images).map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); })
          )
        );
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
        if (cancelled) return;
        const link = document.createElement("a");
        link.download = `payment-received_${fullOrder.orderId}.png`;
        link.href = dataUrl;
        link.click();
      } finally {
        if (!cancelled) {
          el.style.position = "fixed";
          el.style.left = "-9999px";
          el.style.top = "-9999px";
          el.style.zIndex = "";
          el.style.opacity = "";
          el.style.pointerEvents = "";
          setTriggered(false);
          setIsDownloading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [triggered, fullOrder]);

  const totals = fullOrder ? calculateOrderTotals(fullOrder, fullOrder.items) : null;
  const amountLabel = totals
    ? fullOrder!.exchangeRate !== 1
      ? `${formatPrice(totals.totalWithExchange)} ${prefs.exchangeCurrencyCode}`
      : `${prefs.currencySymbol} ${formatPrice(totals.orderTotal)}`
    : "";

  return (
    <>
      <GlassButton
        variant="ghost"
        size="sm"
        onClick={() => { setIsDownloading(true); setTriggered(true); }}
        loading={isDownloading}
        aria-label="Download payment receipt"
      >
        <Receipt className="h-3.5 w-3.5" />
      </GlassButton>
      {fullOrder && (
        <PaymentReceivedTemplate
          ref={receiptRef}
          shop={shop ?? null}
          order={fullOrder}
          customer={fullOrder.customer}
          amountLabel={amountLabel}
          receivedDate={formatDate(new Date())}
        />
      )}
    </>
  );
}
