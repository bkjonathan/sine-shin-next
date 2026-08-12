"use client";

import type { RefObject } from "react";
import type { ShopSettings, CargoShipment } from "@/types";
import { QrCode } from "@/components/ui/qr-code";

/**
 * 35 × 25 mm cargo-item sticker — the small label that goes on the parcel.
 *
 * At 96 CSS dpi that is 132.3 × 94.5 px, rounded to whole pixels below and
 * printed back at exactly 35mm × 25mm (0.3% aspect drift, invisible in print).
 * Everything is pure black on white with no fills or gradients so it survives a
 * thermal printer, and the layout is deliberately sparse: at this size only the
 * QR, the cargo number and the consignee are worth printing.
 */
const LABEL_WIDTH = 132;
const LABEL_HEIGHT = 94;
const QR_SIZE = 58;

const INK = "#000000";
const MUTED = "#3f3f46";

interface CargoItemQrLabelTemplateProps {
  ref: RefObject<HTMLDivElement | null>;
  shop: ShopSettings | null;
  shipment: Pick<CargoShipment, "cargoNo">;
  /** Absolute tracking URL encoded into the QR. */
  trackingUrl: string;
  /** Human-readable form of the code, for when the QR will not scan. */
  publicCode: string;
  orderDisplayId: string | null;
  customerName: string | null;
  bagLabel: string | null;
  weightKg: number;
}

export function CargoItemQrLabelTemplate({
  ref,
  shop,
  shipment,
  trackingUrl,
  publicCode,
  orderDisplayId,
  customerName,
  bagLabel,
  weightKg,
}: CargoItemQrLabelTemplateProps) {
  return (
    <div
      ref={ref}
      style={{
        width: LABEL_WIDTH,
        height: LABEL_HEIGHT,
        fontFamily: "Arial, Helvetica, sans-serif",
        position: "fixed",
        left: "-9999px",
        top: "-9999px",
        background: "#ffffff",
        color: INK,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        padding: "5px 5px 4px",
        overflow: "hidden",
      }}
    >
      {/* ── Cargo no + weight ── */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.01em", whiteSpace: "nowrap" }}>
          {shipment.cargoNo}
        </span>
        <span style={{ fontSize: 9, fontWeight: 800, whiteSpace: "nowrap" }}>
          {weightKg.toFixed(2)}
          <span style={{ fontSize: 7, fontWeight: 700 }}> kg</span>
        </span>
      </div>

      <div style={{ borderTop: `1px solid ${INK}`, margin: "2px 0" }} />

      {/* ── QR + consignee ── */}
      <div style={{ display: "flex", gap: 5, alignItems: "flex-start" }}>
        <QrCode value={trackingUrl} size={QR_SIZE} />
        <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
          <p
            style={{
              margin: 0,
              fontSize: 9,
              fontWeight: 800,
              lineHeight: 1.15,
              // Two lines max — a long name must not push the rest off the label.
              maxHeight: 21,
              overflow: "hidden",
              wordBreak: "break-word",
            }}
          >
            {customerName ?? "—"}
          </p>
          {orderDisplayId && (
            <p style={{ margin: "3px 0 0", fontSize: 7.5, fontWeight: 700, fontFamily: "monospace", color: MUTED }}>
              {orderDisplayId}
            </p>
          )}
          {bagLabel && (
            <p
              style={{
                margin: "3px 0 0",
                fontSize: 7,
                fontWeight: 700,
                color: INK,
                border: `1px solid ${INK}`,
                borderRadius: 3,
                padding: "1px 3px",
                display: "inline-block",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {bagLabel}
            </p>
          )}
        </div>
      </div>

      {/* ── Fallback code + shop, for when the QR is scuffed ── */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: 2,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 4,
        }}
      >
        <span
          style={{
            fontSize: 6.5,
            color: MUTED,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {shop?.shopName ?? "Sine Shin Manager"}
        </span>
        <span style={{ fontSize: 7, fontWeight: 700, fontFamily: "monospace", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
          {publicCode}
        </span>
      </div>
    </div>
  );
}
