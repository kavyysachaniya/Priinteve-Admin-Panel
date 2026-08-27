"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  QuickCreateCustomerDialog,
  type CreatedCustomer,
} from "@/components/customers/quick-create-customer-dialog";

export interface ComboboxCustomer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  type: "INDIVIDUAL" | "BUSINESS";
  gstin: string | null;
}

export function CustomerCombobox({
  customers,
  value,
  onChange,
  onCustomerCreated,
}: {
  customers: ComboboxCustomer[];
  value: string;
  onChange: (customerId: string) => void;
  /** Called (in addition to onChange) when a brand-new customer is created inline. */
  onCustomerCreated?: (customer: ComboboxCustomer) => void;
}) {
  const [open, setOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [localCustomers, setLocalCustomers] = useState(customers);

  const selected = useMemo(() => localCustomers.find((c) => c.id === value), [localCustomers, value]);

  function handleCreated(customer: CreatedCustomer) {
    setLocalCustomers((prev) => [customer, ...prev]);
    onChange(customer.id);
    onCustomerCreated?.(customer);
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {selected ? (
              <span className="flex items-center gap-2 truncate">
                <UserRound className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{selected.name}</span>
                <span className="text-xs text-muted-foreground">{selected.phone}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Select a customer…</span>
            )}
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search customers…" value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty className="p-0">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-primary hover:bg-accent"
                  onClick={() => {
                    setOpen(false);
                    setQuickCreateOpen(true);
                  }}
                >
                  <Plus className="size-4" /> Create &ldquo;{search}&rdquo; as a new customer
                </button>
              </CommandEmpty>
              <CommandGroup>
                {localCustomers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={`${customer.name} ${customer.phone} ${customer.email ?? ""}`}
                    onSelect={() => {
                      onChange(customer.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("size-4", value === customer.id ? "opacity-100" : "opacity-0")} />
                    <div className="min-w-0">
                      <p className="truncate">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">{customer.phone}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setQuickCreateOpen(true);
                  }}
                  className="text-primary"
                >
                  <Plus className="size-4" /> Create new customer
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <QuickCreateCustomerDialog
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        onCreated={handleCreated}
        initialName={search}
      />
    </>
  );
}
