import type { CargoStatus } from "@/types";

/** Shipment progress, in the order a parcel actually moves through it. */
export const JOURNEY: CargoStatus[] = ["pending", "in_transit", "arrived", "delivered"];

/**
 * Once a parcel is delivered the tracking page closes: the QR sticker stays on
 * the box long after the job is done, so consignee and carrier details stop
 * being published at that point.
 */
export function isTrackingClosed(status: CargoStatus): boolean {
  return status === "delivered";
}

export const STATUS_META: Record<CargoStatus, { label: string; className: string; dot: string }> = {
  pending:    { label: "Pending",    className: "border-line bg-surface-hover text-t2",                             dot: "bg-t3" },
  in_transit: { label: "In Transit", className: "border-[rgba(50,184,255,0.3)] bg-[rgba(50,184,255,0.14)] text-info",    dot: "bg-info" },
  arrived:    { label: "Arrived",    className: "border-[rgba(255,176,32,0.3)] bg-[rgba(255,176,32,0.14)] text-warning", dot: "bg-warning" },
  delivered:  { label: "Delivered",  className: "border-[rgba(49,201,126,0.3)] bg-[rgba(49,201,126,0.14)] text-success", dot: "bg-success" },
  cancelled:  { label: "Cancelled",  className: "border-[rgba(255,92,92,0.3)] bg-[rgba(255,92,92,0.14)] text-danger",    dot: "bg-danger" },
};
