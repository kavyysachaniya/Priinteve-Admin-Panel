import { BlockedUrlError, fetchPublicUrl } from "@/lib/services/companion/net";
import { plural, worstStatus, type BriefingContext, type BriefingItem, type IntegrationResult } from "@/lib/services/companion/types";

const TIMEOUT_MS = 8_000;
const SLOW_MS = 3_000;

export type WebsiteHealth = "up" | "slow" | "client_error" | "down";

export interface WebsiteCheck {
  health: WebsiteHealth;
  status?: number;
  ms: number;
  error?: string;
}

/** Classifies one URL: up (≤3 s), slow (>3 s), client error (4xx) or down (5xx, timeout, network). */
export async function checkWebsite(url: string): Promise<WebsiteCheck> {
  const started = performance.now();
  try {
    const res = await fetchPublicUrl(url, TIMEOUT_MS);
    const ms = Math.round(performance.now() - started);
    if (res.status >= 500) return { health: "down", status: res.status, ms };
    if (res.status >= 400) return { health: "client_error", status: res.status, ms };
    return { health: ms > SLOW_MS ? "slow" : "up", status: res.status, ms };
  } catch (err) {
    const ms = Math.round(performance.now() - started);
    if (err instanceof BlockedUrlError) return { health: "down", ms, error: err.message };
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return { health: "down", ms, error: timedOut ? "No response in 8 s" : "Couldn't connect" };
  }
}

function formatMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}

function toItem(label: string, url: string, check: WebsiteCheck): BriefingItem {
  switch (check.health) {
    case "up":
      return { label, detail: `Up · ${formatMs(check.ms)}`, status: "ok", url };
    case "slow":
      return { label, detail: `Slow · ${formatMs(check.ms)}`, status: "warn", url };
    case "client_error":
      return { label, detail: `Client error · HTTP ${check.status}`, status: "warn", url };
    case "down":
      return {
        label,
        detail: check.status ? `Down · HTTP ${check.status}` : `Down · ${check.error ?? "no response"}`,
        status: "error",
        url,
      };
  }
}

export async function websitesIntegration(ctx: BriefingContext): Promise<IntegrationResult | null> {
  const sites = ctx.settings.websites;
  if (sites.length === 0) return null;

  const checks = await Promise.all(sites.map((site) => checkWebsite(site.url)));
  const items = sites.map((site, i) => toItem(site.label, site.url, checks[i]));

  const down = checks.filter((c) => c.health === "down").length;
  const degraded = checks.filter((c) => c.health === "slow" || c.health === "client_error").length;
  const summary =
    down > 0
      ? `${plural(down, "site")} down`
      : degraded > 0
        ? `${plural(degraded, "site")} need a look`
        : sites.length === 1
          ? "your site is up"
          : `all ${sites.length} sites are up`;

  return {
    section: { key: "websites", title: "Websites", status: worstStatus(items), items },
    summary,
    notable: items.some((i) => i.status !== "ok"),
  };
}
