"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QrCodeProps {
  /** Text to encode — usually an absolute tracking URL. */
  value: string;
  /** Rendered edge length in CSS px. */
  size: number;
  /**
   * Error-correction level. "M" is the default trade-off; "L" keeps the module
   * count down when a long payload would otherwise push the QR to a higher
   * version than a small label can carry.
   */
  level?: "L" | "M" | "Q" | "H";
  className?: string;
}

/**
 * QR rendered as inline SVG rather than a PNG.
 *
 * The labels are rasterised by html-to-image at a high pixel ratio for thermal
 * printing; a fixed-resolution PNG would get resampled on the way and soften
 * the module edges, which is exactly what makes a small QR fail to scan. SVG
 * stays vector until the final rasterisation, so modules land on crisp edges at
 * whatever resolution the label is printed at.
 */
export function QrCode({ value, size, level = "M", className }: QrCodeProps) {
  // Tagged with the value it was generated from, so a stale QR is never shown
  // (or rasterised onto a label) while the next one is still encoding.
  const [rendered, setRendered] = useState<{ value: string; markup: string } | null>(null);

  useEffect(() => {
    if (!value) return;
    let cancelled = false;
    QRCode.toString(value, { type: "svg", margin: 0, errorCorrectionLevel: level })
      .then((markup) => {
        if (cancelled) return;
        // node-qrcode stamps its own width/height on the root <svg>; override
        // them so the QR fills the box the caller sized.
        setRendered({ value, markup: markup.replace("<svg ", '<svg style="width:100%;height:100%;display:block" ') });
      })
      .catch(() => {
        if (!cancelled) setRendered(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, level]);

  const markup = rendered?.value === value ? rendered.markup : "";

  return (
    <div
      className={className}
      style={{ width: size, height: size, flexShrink: 0, background: "#ffffff" }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
