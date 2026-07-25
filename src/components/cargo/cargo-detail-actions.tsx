"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassButton } from "@/components/ui/glass-button";
import { useDeleteCargoShipment } from "@/hooks/use-cargo";
import { Trash2 } from "lucide-react";

interface CargoDetailActionsProps {
  cargoShipmentId: string;
}

export function CargoDetailActions({ cargoShipmentId }: CargoDetailActionsProps) {
  const router = useRouter();
  const deleteShipment = useDeleteCargoShipment();
  const [confirming, setConfirming] = useState(false);

  function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    deleteShipment.mutate(cargoShipmentId, {
      onSuccess: () => router.push("/cargo"),
    });
  }

  return (
    <GlassButton
      variant={confirming ? "danger" : "ghost"}
      size="sm"
      loading={deleteShipment.isPending}
      onClick={handleDelete}
      onBlur={() => setConfirming(false)}
    >
      <Trash2 className="h-3.5 w-3.5" />
      {confirming && <span className="text-xs">Confirm</span>}
    </GlassButton>
  );
}
