import { GlassBadge } from "@/components/ui/glass-badge";
import type { OrderStatus } from "@/types";

const variantMap: Record<OrderStatus, "neutral" | "warning" | "info" | "success" | "danger"> = {
  pending: "neutral",
  ordered: "warning",
  arrived: "info",
  shipping: "warning",
  completed: "success",
  cancelled: "danger",
};

const labelMap: Record<OrderStatus, string> = {
  pending: "Pending",
  ordered: "Ordered",
  arrived: "Arrived",
  shipping: "Shipping",
  completed: "Completed",
  cancelled: "Cancelled",
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
