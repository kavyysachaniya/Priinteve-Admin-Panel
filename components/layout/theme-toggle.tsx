"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const noopSubscribe = () => () => {};

/**
 * True only once the component has actually mounted on the client.
 * `resolvedTheme` from next-themes is `undefined` during SSR but is already
 * resolved by the client's very first render (before hydration finishes) —
 * branching on `resolvedTheme` directly causes a server/client mismatch on
 * whatever that branch renders (e.g. a `disabled` attribute), which React
 * won't patch up, leaving the control stuck. useSyncExternalStore's
 * server/client snapshot split is the sanctioned way to read something that
 * legitimately differs between the two without tripping the mismatch warning
 * (unlike a `useState`+`useEffect` "mounted" flag, which does exactly what we
 * need but reintroduces a "setState in an effect" lint complaint).
 */
function useHasMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

export function ThemeToggle() {
  const hasMounted = useHasMounted();
  const { resolvedTheme, setTheme } = useTheme();

  if (!hasMounted) {
    return (
      <Button variant="ghost" size="icon" disabled aria-label="Toggle theme">
        <Sun className="size-[18px]" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </Button>
  );
}
