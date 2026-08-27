"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS } from "@/lib/nav-config";
import { ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import type { UserRole } from "@prisma/client";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

export function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role as UserRole | undefined;

  // Filter sections and items based on permissions
  const filteredSections = NAV_SECTIONS.map((section) => {
    const filteredItems = section.items.filter((item) => {
      if (!item.requiredPermission) return true;
      if (!role) return false; // Hide protected items if session is not loaded yet
      return ROLE_PERMISSIONS[role]?.includes(item.requiredPermission) ?? false;
    });
    return { ...section, items: filteredItems };
  }).filter((section) => section.items.length > 0);

  return (
    <nav className="flex flex-1 flex-col gap-3.5 overflow-y-auto no-scrollbar px-3 py-2">
      {filteredSections.map((section, i) => (
        <div key={section.label ?? `section-${i}`} className="flex flex-col gap-0.5">
          {section.label && !collapsed ? (
            <p className="px-2.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
              {section.label}
            </p>
          ) : null}
          {section.items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            const link = (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  collapsed && "justify-center px-0",
                  active
                    ? "bg-sidebar-primary/15 text-sidebar-primary-foreground text-white"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-primary" : "text-sidebar-foreground/55 group-hover:text-sidebar-accent-foreground"
                  )}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            }
            return link;
          })}
        </div>
      ))}
    </nav>
  );
}
