"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS } from "@/lib/nav-config";
import { ROLE_PERMISSIONS } from "@/lib/auth/permissions";
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
  const role = session?.user?.role;

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
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto no-scrollbar px-3 py-3">
      {filteredSections.map((section, i) => (
        <div key={section.label ?? `section-${i}`} className="flex flex-col gap-0.5">
          {section.label && !collapsed ? (
            <p className="px-2.5 pt-2 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-sidebar-foreground/50 select-none">
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
                  "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150 ease-in-out",
                  collapsed && "justify-center px-0 py-2",
                  active
                    ? "bg-sidebar-primary/10 text-sidebar-primary dark:bg-sidebar-primary/20 dark:text-sidebar-accent-foreground font-semibold shadow-xs"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "size-[18px] shrink-0 transition-colors",
                    active
                      ? "text-sidebar-primary dark:text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/60 group-hover:text-sidebar-accent-foreground"
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
                  <TooltipContent side="right" className="font-medium">
                    {item.label}
                  </TooltipContent>
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
