import { GlassBadge } from "@/components/ui/glass-badge";
import type { CargoStatus } from "@/types";

const variantMap: Record<CargoStatus, "neutral" | "warning" | "info" | "success" | "danger"> = {
  pending: "neutral",
  in_transit: "warning",
  arrived: "info",
  delivered: "success",
  cancelled: "danger",
};

const labelMap: Record<CargoStatus, string> = {
  pending: "Pending",
  in_transit: "In Transit",
  arrived: "Arrived",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

interface CargoStatusBadgeProps {
  status: string;
}

export function CargoStatusBadge({ status }: CargoStatusBadgeProps) {
  const s = status as CargoStatus;
  return (
    <GlassBadge variant={variantMap[s] ?? "neutral"}>
      {labelMap[s] ?? status}
    </GlassBadge>
  );
}
