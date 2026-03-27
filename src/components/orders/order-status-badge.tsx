import { GlassBadge } from "@/components/ui/glass-badge";
import type { OrderStatus } from "@/types";

const variantMap: Record<OrderStatus, "neutral" | "warning" | "info" | "success"> = {
  pending: "neutral",
  processing: "warning",
  arrived: "info",
  completed: "success",
};

const labelMap: Record<OrderStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  arrived: "Arrived",
  completed: "Completed",
};

interface OrderStatusBadgeProps {
  status: string;
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const s = status as OrderStatus;
  return (
    <GlassBadge variant={variantMap[s] ?? "neutral"}>
      {labelMap[s] ?? status}
    </GlassBadge>
  );
}
