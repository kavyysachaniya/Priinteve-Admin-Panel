"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { useSession, signOut } from "next-auth/react";
import { Menu, Search, Plus, Settings, LogOut, ChevronDown, UserRound } from "lucide-react";
import { NAV_SECTIONS, QUICK_ACTIONS } from "@/lib/nav-config";
import { ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { LogoMark } from "@/components/layout/logo-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ActiveTimerHeaderChip } from "@/components/projects/active-timer-header-chip";
import { NotificationBell } from "@/components/layout/notification-bell";

function currentSectionLabel(pathname: string): string {
  if (pathname.startsWith("/account")) return "My account";
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href)) {
        return item.label;
      }
    }
  }
  return "Priinteve";
}

function getInitials(name?: string | null): string {
  if (!name) return "US";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Topbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const title = currentSectionLabel(pathname);
  const { data: session } = useSession();

  const user = session?.user;
  const role = user?.role;

  // Filter quick actions based on permissions
  const filteredQuickActions = QUICK_ACTIONS.filter((action) => {
    if (!action.requiredPermission) return true;
    if (!role) return false;
    return ROLE_PERMISSIONS[role]?.includes(action.requiredPermission) ?? false;
  });

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </Button>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[260px] bg-sidebar p-0 text-sidebar-foreground border-r border-sidebar-border [&_svg]:shrink-0">
          <SheetHeader className="h-14 flex-row items-center border-b border-sidebar-border px-4">
            <SheetTitle asChild>
              <LogoMark />
            </SheetTitle>
          </SheetHeader>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <h1 className="text-[15px] font-semibold tracking-tight">{title}</h1>

      <div className="ml-2 hidden max-w-sm flex-1 md:block">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search customers, quotations, invoices…"
            className="h-9 bg-muted/50 pl-8 text-sm"
            onFocus={(e) => e.currentTarget.blur()}
            readOnly
            onClick={() => toast.info("Global search is coming soon")}
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ActiveTimerHeaderChip />

        {filteredQuickActions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5 font-medium shadow-xs">
                <Plus className="size-4" />
                <span className="hidden sm:inline">New</span>
                <ChevronDown className="size-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {filteredQuickActions.map((action) => (
                <DropdownMenuItem key={action.href} asChild>
                  <Link href={action.href}>{action.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <ThemeToggle />

        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="size-8 ring-1 ring-border">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {getInitials(user?.name)}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{user?.name || "Loading…"}</p>
              <p className="text-xs text-muted-foreground">{user?.email || ""}</p>
              {role && (
                <p className="text-[10px] font-semibold uppercase text-primary mt-1">
                  {role}
                </p>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/account">
                <UserRound className="size-4" /> My account
              </Link>
            </DropdownMenuItem>
            {role && ROLE_PERMISSIONS[role]?.includes("settings:view") && (
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="size-4" /> Settings
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => signOut({ redirectTo: "/login" })}
            >
              <LogOut className="size-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
