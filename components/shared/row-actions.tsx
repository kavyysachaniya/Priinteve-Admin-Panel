"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * A single always-visible icon action for a table row (e.g. View, Edit).
 */
export function QuickAction({
  icon: Icon,
  label,
  href,
  onClick,
  destructive,
}: {
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
  destructive?: boolean;
}) {
  const button = (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "size-7 text-muted-foreground hover:text-foreground transition-colors",
        destructive && "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
      )}
      asChild={!!href}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {href ? (
        <Link href={href} aria-label={label}>
          <Icon className="size-3.5" />
        </Link>
      ) : (
        <Icon className="size-3.5" />
      )}
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Delete action trigger button with Trash2 Lucide icon.
 */
export function DeleteRowButton({
  label = "Delete",
  onClick,
  disabled,
}: {
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
          aria-label={label}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Container for a row's action cell: View, Edit, and Delete icon buttons. */
export function RowActionsBar({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-end gap-1">{children}</div>;
}
