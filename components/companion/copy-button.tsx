"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.");
    }
  }
  return (
    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={copy}>
      <Copy className="size-3.5" /> {label}
    </Button>
  );
}
