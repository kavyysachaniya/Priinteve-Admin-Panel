import { net } from "electron";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseBriefing, type Briefing } from "../shared/briefing";
import { log, describeError } from "./log";
import { getConnection, readCachedBriefing, writeCachedBriefing } from "./store";

/** Seconds to wait before each attempt. After boot the network is often not up yet. */
export const BOOT_RETRY_DELAYS = [0, 2, 5, 10, 20, 30];
export const QUICK_RETRY_DELAYS = [0, 3];
const REQUEST_TIMEOUT_MS = 15_000;

export type BriefingSource = "live" | "cache" | "fallback" | "sample";

export interface BriefingResult {
  briefing: Briefing;
  source: BriefingSource;
}

class TokenRejectedError extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function loadSampleBriefing(): Briefing {
  const file = path.join(__dirname, "..", "assets", "sample-briefing.json");
  const parsed = parseBriefing(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed) throw new Error("Sample briefing is malformed");
  return { ...parsed, generatedAt: new Date().toISOString() };
}

async function requestBriefing(serverUrl: string, token: string, fresh = false, daily = false): Promise<Briefing> {
  const url = new URL("/api/companion/briefing", serverUrl);
  if (fresh) url.searchParams.set("fresh", "1");
  // First briefing of the day: the panel also runs the websites, Slack and email checks.
  if (daily) url.searchParams.set("daily", "1");
  const res = await net.fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    redirect: "error",
  });
  if (res.status === 401 || res.status === 403) {
    throw new TokenRejectedError(`Server rejected the device token (HTTP ${res.status})`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const briefing = parseBriefing(await res.json());
  if (!briefing) throw new Error("Server returned an unexpected response");
  return briefing;
}

function fallbackBriefing(title: string, detail: string): Briefing {
  return {
    generatedAt: new Date().toISOString(),
    mascotName: "Inky",
    ownerName: "there",
    greeting: "Good morning",
    summary: "I couldn't fetch today's briefing.",
    mood: "worried",
    offline: true,
    sections: [
      {
        key: "connection",
        title: "Connection",
        status: "warn",
        items: [{ label: title, detail, status: "warn" }],
      },
    ],
  };
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "earlier";
  return date.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

/**
 * Fetch the briefing, retrying on network errors. Never throws: when every attempt fails it
 * returns the last cached briefing (marked offline) or a built-in fallback.
 */
export async function getBriefing(
  delays: number[],
  onAttempt?: (attempt: number, total: number) => void,
  useSample = false,
  fresh = false,
  daily = false,
): Promise<BriefingResult> {
  const connection = getConnection();
  if (useSample || !connection) {
    try {
      return { briefing: loadSampleBriefing(), source: "sample" };
    } catch (err) {
      log("error", `Sample briefing failed: ${describeError(err)}`);
      return {
        briefing: fallbackBriefing("Not set up yet", "Open settings from the tray icon to connect."),
        source: "fallback",
      };
    }
  }

  let lastError = "unknown error";
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await sleep(delays[i] * 1000);
    onAttempt?.(i + 1, delays.length);
    try {
      const briefing = await requestBriefing(connection.serverUrl, connection.token, fresh, daily);
      writeCachedBriefing(briefing);
      log("info", `Briefing fetched on attempt ${i + 1}`);
      return { briefing, source: "live" };
    } catch (err) {
      lastError = describeError(err);
      log("warn", `Briefing attempt ${i + 1}/${delays.length} failed: ${lastError}`);
      if (err instanceof TokenRejectedError) {
        return {
          briefing: fallbackBriefing(
            "This device isn't paired any more",
            "Create a new device token on the Companion page, then paste it in settings.",
          ),
          source: "fallback",
        };
      }
    }
  }

  const cached = readCachedBriefing();
  if (cached) {
    return {
      briefing: {
        ...cached,
        offline: true,
        offlineNote: `Offline. This is the briefing from ${formatTime(cached.generatedAt)}.`,
      },
      source: "cache",
    };
  }
  return {
    briefing: fallbackBriefing("Can't reach the server", "I'll try again when you press Refresh."),
    source: "fallback",
  };
}

/** Used by the settings window's "Test connection" button. */
export async function testConnection(serverUrl: string, token: string): Promise<string> {
  try {
    const briefing = await requestBriefing(serverUrl, token);
    return `Connected. ${briefing.sections.length} sections in today's briefing.`;
  } catch (err) {
    return err instanceof TokenRejectedError
      ? "The server rejected this token."
      : `Couldn't connect: ${err instanceof Error ? err.message : String(err)}`;
  }
}
