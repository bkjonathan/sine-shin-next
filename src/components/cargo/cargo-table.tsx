"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { GlassButton } from "@/components/ui/glass-button";
import { CargoStatusBadge } from "./cargo-status-badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useDeleteCargoShipment } from "@/hooks/use-cargo";
import { useCurrencyPrefs } from "@/hooks/use-currency-prefs";
import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import type { CargoShipmentListItem } from "@/types";

interface CargoTableProps {
  shipments: CargoShipmentListItem[];
  isLoading?: boolean;
}

export function CargoTable({ shipments, isLoading }: CargoTableProps) {
  const deleteShipment = useDeleteCargoShipment();
  const { prefs } = useCurrencyPrefs();

  const columns: ColumnDef<CargoShipmentListItem>[] = [
    {
      accessorKey: "cargoNo",
      header: "CARGO NO",
      cell: ({ row }) => (
        <Link href={`/cargo/${row.original.id}`} className="hover:opacity-80">
          <span className="inline-flex items-center rounded-lg border border-line bg-surface px-2.5 py-1 font-mono text-xs text-t2">
            {row.original.cargoNo}
          </span>
        </Link>
      ),
    },
    {
      accessorKey: "carrierName",
      header: "CARRIER",
      cell: ({ row }) => (
        <span className="text-sm text-t1">{row.original.carrierName ?? "—"}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "STATUS",
      cell: ({ row }) => <CargoStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "createdAt",
      header: "DATE",
      cell: ({ row }) => (
        <span className="text-sm text-t2">{formatDate(row.original.createdAt, "dd-MM-yyyy")}</span>
      ),
    },
    {
      id: "weight",
      header: "WEIGHT (KG)",
      cell: ({ row }) => (
        <span className="text-sm text-t1">{(row.original.totalWeight ?? 0).toFixed(2)} kg</span>
      ),
    },
    {
      id: "profit",
      header: "PROFIT",
      cell: ({ row }) => {
        const profit = (row.original.receiverOwed ?? 0) - (row.original.carrierOwed ?? 0);
        return (
          <span className={`text-sm font-semibold ${profit >= 0 ? "text-success" : "text-danger"}`}>
            {formatCurrency(profit, prefs.currencySymbol)}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "ACTIONS",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <GlassButton variant="ghost" size="sm" asChild aria-label="Open shipment">
            <Link href={`/cargo/${row.original.id}`}>
              <Pencil className="h-3.5 w-3.5" />
            </Link>
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => { if (confirm("Delete this cargo shipment?")) deleteShipment.mutate(row.original.id); }}
            className="hover:text-danger"
            aria-label="Delete shipment"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </GlassButton>
        </div>
      ),
    },
  ];

  return (
    <DataTable columns={columns} data={shipments} isLoading={isLoading} emptyMessage="No cargo shipments found" />
  );
}
