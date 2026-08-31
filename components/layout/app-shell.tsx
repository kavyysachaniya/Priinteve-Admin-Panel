"use client";

import { useSyncExternalStore } from "react";
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

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-dvh w-full overflow-hidden bg-muted/30">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 overflow-x-hidden">
              {children}
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
