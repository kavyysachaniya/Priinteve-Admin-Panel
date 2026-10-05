"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { TooltipProvider } from "@/components/ui/tooltip";

const STORAGE_KEY = "priinteve.sidebar.collapsed";

/**
 * The collapsed flag lives in localStorage, which the server can't read. Modelling
 * it as an external store (rather than useState + a "hydrate me" effect) keeps the
 * server and the client's first render in agreement — getServerSnapshot is also
 * what React uses for the initial client render during hydration — so there's no
 * mismatch, and no setState-inside-an-effect.
 */
const listeners = new Set<() => void>();
let snapshot: boolean | null = null;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Keep other tabs in sync too.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      snapshot = e.newValue === "1";
      listeners.forEach((l) => l());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): boolean {
  // Cached so repeated calls stay referentially stable for useSyncExternalStore.
  if (snapshot === null) {
    try {
      snapshot = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      snapshot = false;
    }
  }
  return snapshot;
}

function getServerSnapshot(): boolean {
  return false;
}

function setCollapsed(next: boolean) {
  snapshot = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {}
  listeners.forEach((l) => l());
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // The task board uses the whole screen width; every other page keeps the readable 1400px column.
  const fullWidth = usePathname() === "/tasks";

  return (
    <TooltipProvider delayDuration={200}>
      {/* print: variants release the viewport-locked, scrolling shell so printed documents
          aren't clipped to one screen and don't include app chrome. Screen layout is unchanged. */}
      <div className="flex h-screen h-dvh min-h-0 w-full overflow-hidden bg-muted/30 print:block print:h-auto print:overflow-visible print:bg-white">
        <div className="contents print-hide">
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:block print:overflow-visible">
          <div className="contents print-hide">
            <Topbar />
          </div>
          <main className="flex-1 overflow-y-auto overflow-x-hidden print:overflow-visible">
            <div className={`mx-auto w-full ${fullWidth ? "max-w-none" : "max-w-[1400px]"} px-4 py-6 sm:px-6 lg:px-8 overflow-x-hidden print:max-w-none print:overflow-visible print:p-0`}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
