"use client";

import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { LogoMark } from "@/components/layout/logo-mark";
import { cn } from "@/lib/utils";

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={cn(
        "hidden lg:flex lg:flex-col shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-in-out shadow-xs",
        collapsed ? "lg:w-[68px]" : "lg:w-[240px]"
      )}
    >
      <div className={cn("flex h-14 items-center border-b border-sidebar-border px-4", collapsed && "px-0 justify-center")}>
        <LogoMark collapsed={collapsed} />
      </div>

      <SidebarNav collapsed={collapsed} />

      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 border-t border-sidebar-border px-4 py-3 text-xs font-medium text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        {collapsed ? (
          <ChevronsRight className="mx-auto size-4" strokeWidth={1.75} />
        ) : (
          <>
            <ChevronsLeft className="size-4" strokeWidth={1.75} />
            <span>Collapse</span>
          </>
        )}
      </button>
    </aside>
  );
}
