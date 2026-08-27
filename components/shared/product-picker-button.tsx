"use client";

import { useState } from "react";
import { Package } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/money";

export interface PickableProduct {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  sellingPricePaise: number;
  gstRate: number;
  type: "PRODUCT" | "SERVICE";
}

export function ProductPickerButton({
  products,
  onSelect,
}: {
  products: PickableProduct[];
  onSelect: (product: PickableProduct) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="shrink-0">
              <Package className="size-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Pick from Products &amp; Services</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search products…" />
          <CommandList>
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">No products found.</CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.name}
                  onSelect={() => {
                    onSelect(product);
                    setOpen(false);
                  }}
                >
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.type === "PRODUCT" ? "Product" : "Service"} · {product.gstRate}% GST</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                      {formatCurrency(product.sellingPricePaise)}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
