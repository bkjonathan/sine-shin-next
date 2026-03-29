"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassButton } from "@/components/ui/glass-button";
import { useDeleteOrder } from "@/hooks/use-orders";
import { Pencil, Trash2, Printer } from "lucide-react";
import Link from "next/link";

interface OrderDetailActionsProps {
  orderId: string;
}

export function OrderDetailActions({ orderId }: OrderDetailActionsProps) {
  const router = useRouter();
  const deleteOrder = useDeleteOrder();
  const [confirming, setConfirming] = useState(false);

  function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    deleteOrder.mutate(orderId, {
      onSuccess: () => router.push("/orders"),
    });
  }

  return (
    <div className="flex items-center gap-2">
      <GlassButton variant="ghost" size="sm" asChild>
        <Link href={`/orders?edit=${orderId}`}>
          <Pencil className="h-3.5 w-3.5" />
        </Link>
      </GlassButton>
      <GlassButton
        variant={confirming ? "danger" : "ghost"}
        size="sm"
        loading={deleteOrder.isPending}
        onClick={handleDelete}
        onBlur={() => setConfirming(false)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {confirming && <span className="text-xs">Confirm</span>}
      </GlassButton>
    </div>
  );
}
