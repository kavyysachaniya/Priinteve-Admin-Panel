"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function RowActions({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * A single always-visible icon action for a table row (e.g. View, Edit) — used
 * so the two most common actions don't require opening the overflow menu.
 * Lower-frequency and destructive actions stay inside `RowActions`.
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
      className={cn("size-8", destructive && "text-destructive hover:text-destructive")}
      asChild={!!href}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {href ? (
        <Link href={href} aria-label={label}>
          <Icon className="size-4" />
        </Link>
      ) : (
        <Icon className="size-4" />
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

/** Container for a row's action cell: quick icon actions + the overflow menu. */
export function RowActionsBar({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-end gap-0.5">{children}</div>;
}
