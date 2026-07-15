"use client";

import { useState, useRef } from "react";
import { Search, ChevronDown, Check, X, Plus } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { useQueryClient } from "@tanstack/react-query";
import { useCustomers, useCustomer, useCreateCustomer } from "@/hooks/use-customers";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { GlassModal } from "@/components/ui/glass-modal";
import { CustomerForm } from "@/components/customers/customer-form";
import type { CreateCustomerInput } from "@/validations/customer.schema";

interface CustomerComboboxProps {
  value?: string;
  onValueChange?: (value: string) => void;
  label?: string;
  error?: string;
  placeholder?: string;
  allowCreate?: boolean;
}

export function CustomerCombobox({
  value,
  onValueChange,
  label,
  error,
  placeholder = "Search customer...",
  allowCreate = true,
}: CustomerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const createCustomer = useCreateCustomer();

  const { data: customersData, isLoading } = useCustomers({
    limit: 10,
    search: debouncedSearch || undefined,
    searchField: debouncedSearch ? "all" : undefined,
    sort: "createdAt",
    order: "desc",
    enabled: open,
  });

  const customers = customersData?.data ?? [];

  const selectedCustomer = customers.find((c) => c.id === value);

  // Fetch the selected customer by ID when not in the current search results
  const { data: fetchedCustomer } = useCustomer(
    value && !selectedCustomer ? value : undefined
  );

  const resolvedCustomer = selectedCustomer ?? fetchedCustomer;
  const selectedLabel = resolvedCustomer
    ? `${resolvedCustomer.name} (${resolvedCustomer.customerId})`
    : "";

  const handleSelect = (customerId: string) => {
    onValueChange?.(customerId);
    setSearch("");
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange?.("");
    setSearch("");
  };

  const handleOpenCreate = () => {
    setOpen(false);
    setCreating(true);
  };

  const handleCreate = (data: CreateCustomerInput) => {
    createCustomer.mutate(data, {
      onSuccess: (customer) => {
        // Seed the cache so the trigger label resolves without waiting for a refetch
        queryClient.setQueryData(["customers", customer.id], customer);
        onValueChange?.(customer.id);
        setSearch("");
        setCreating(false);
      },
    });
  };

  return (
    <div className="w-full">
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-t2">{label}</label>
      )}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm",
              "bg-field border border-line text-t1",
              "backdrop-blur-xl",
              "outline-none transition-all duration-200",
              "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.12)]",
              "focus:border-accent-border focus:bg-[var(--bg-panel)] focus:ring-4 focus:ring-accent-bg/60",
              !value && "text-t4",
              error && "border-[rgba(255,59,48,0.55)] focus:border-[rgba(255,59,48,0.7)] focus:ring-[rgba(255,59,48,0.14)]"
            )}
          >
            <span className="truncate">
              {selectedLabel || placeholder}
            </span>
            <span className="flex items-center gap-1">
              {value && (
                <span
                  onClick={handleClear}
                  className="rounded-full p-0.5 hover:bg-surface-hover"
                >
                  <X className="h-3.5 w-3.5 text-t3" />
                </span>
              )}
              <ChevronDown className="h-4 w-4 text-t3" />
            </span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-2xl border border-line bg-panel backdrop-blur-2xl shadow-[var(--shadow-card)]"
            sideOffset={4}
            align="start"
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              inputRef.current?.focus();
            }}
          >
            <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
              <Search className="h-4 w-4 text-t3 shrink-0" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or ID..."
                className="w-full bg-transparent text-sm text-t1 placeholder:text-t4 outline-none"
              />
            </div>
            <div className="max-h-60 overflow-y-auto p-1.5">
              {isLoading ? (
                <div className="px-3 py-6 text-center text-sm text-t3">Loading...</div>
              ) : customers.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-t3">
                  {search ? `No customers match "${search}"` : "No customers found"}
                </div>
              ) : (
                customers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => handleSelect(customer.id)}
                    className={cn(
                      "relative flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-t2 outline-none select-none",
                      "hover:bg-surface-hover hover:text-t1",
                      value === customer.id && "bg-surface-hover text-t1"
                    )}
                  >
                    <div className="flex flex-col items-start">
                      <span>{customer.name}</span>
                      <span className="text-xs text-t3">{customer.customerId}</span>
                    </div>
                    {value === customer.id && (
                      <span className="absolute right-3">
                        <Check className="h-3.5 w-3.5 text-accent" />
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
            {allowCreate && (
              <div className="border-t border-line p-1.5">
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-accent outline-none select-none hover:bg-surface-hover"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {search ? `Add "${search}" as new customer` : "Add new customer"}
                  </span>
                </button>
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}

      {allowCreate && (
        <GlassModal open={creating} onOpenChange={setCreating} title="New Customer">
          <CustomerForm
            defaultValues={{ name: search }}
            onSubmit={handleCreate}
            isLoading={createCustomer.isPending}
            onCancel={() => setCreating(false)}
          />
        </GlassModal>
      )}
    </div>
  );
}
