"use client";

import type { RefObject } from "react";
import type { ShopSettings } from "@/types";
import type { CargoPartyType } from "@/validations/cargo.schema";

interface CargoPaymentReceiptTemplateProps {
  ref: RefObject<HTMLDivElement | null>;
  shop: ShopSettings | null;
  cargoNo: string;
  partyType: CargoPartyType;
  partyName: string | null;
  amountLabel: string;
  paidDate: string;
  method?: string | null;
  note?: string | null;
}

export function CargoPaymentReceiptTemplate({
  ref,
  shop,
  cargoNo,
  partyType,
  partyName,
  amountLabel,
  paidDate,
  method,
  note,
}: CargoPaymentReceiptTemplateProps) {
  const isReceiver = partyType === "receiver";
  const accent = isReceiver ? "#1a8f4c" : "#2563eb";
  const heading = isReceiver ? "PAYMENT RECEIVED" : "PAYMENT MADE";
  const subtitle = isReceiver
    ? "Thank you for your payment.\nYour transaction was successful."
    : "Payment made to carrier for this cargo shipment.";
  const amountLabelText = isReceiver ? "Amount Received" : "Amount Paid";

  const rows: Array<{ label: string; value: string }> = [
    { label: "Merchant", value: shop?.shopName ?? "—" },
    ...(shop?.phone ? [{ label: "Phone", value: shop.phone }] : []),
    { label: "Cargo No", value: cargoNo },
    { label: isReceiver ? "Customer" : "Carrier", value: partyName ?? "—" },
    ...(method ? [{ label: "Method", value: method }] : []),
    ...(note ? [{ label: "Note", value: note }] : []),
  ];

  return (
    <div
      ref={ref}
      style={{
        width: "480px",
        fontFamily: "Arial, Helvetica, sans-serif",
        position: "fixed",
        left: "-9999px",
        top: "-9999px",
        background: "#f4f5f7",
        color: "#1e293b",
        boxSizing: "border-box",
        padding: "48px 36px",
      }}
    >
      {/* ── Shop logo / name ── */}
      <div style={{ textAlign: "center" }}>
        {shop?.logoUrl ? (
          <img
            src={shop.logoUrl}
            alt="logo"
            style={{ width: 128, height: 128, objectFit: "contain", margin: "0 auto", display: "block" }}
          />
        ) : (
          <p style={{ fontSize: 28, fontWeight: 700, color: "#0f172a", margin: 0 }}>
            {shop?.shopName ?? "Sine Shin Manager"}
          </p>
        )}
      </div>

      {/* ── Icon ── */}
      <div style={{ textAlign: "center", marginTop: 28 }}>
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: "50%",
            background: accent,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
      </div>

      <p style={{ textAlign: "center", fontSize: 28, fontWeight: 800, color: accent, margin: "20px 0 6px", letterSpacing: "0.01em" }}>
        {heading}
      </p>
      <p style={{ textAlign: "center", fontSize: 14, color: "#475569", margin: 0, lineHeight: 1.5, whiteSpace: "pre-line" }}>
        {subtitle}
      </p>

      {/* ── Detail card ── */}
      <div style={{ marginTop: 32, background: "white", borderRadius: 18, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <div style={{ padding: "8px 24px" }}>
          {rows.map((row, i) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
                padding: "14px 0",
                borderTop: i === 0 ? "none" : "1px solid #eef2f6",
              }}
            >
              <span style={{ fontSize: 14, color: "#64748b", whiteSpace: "nowrap" }}>{row.label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", textAlign: "right", maxWidth: 280, whiteSpace: "pre-line" }}>
                {row.value}
              </span>
            </div>
          ))}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderTop: "1px solid #eef2f6" }}>
            <span style={{ fontSize: 14, color: "#64748b" }}>{amountLabelText}</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: accent }}>{amountLabel}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 20px", borderTop: "1px solid #eef2f6" }}>
            <span style={{ fontSize: 14, color: "#64748b" }}>Date</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{paidDate}</span>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ background: accent, color: "white", textAlign: "center", padding: "18px 24px" }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>Thank you for your business!</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.9 }}>We appreciate your trust and support.</p>
        </div>
      </div>
    </div>
  );
}
