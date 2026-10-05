import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Outbound requests to user-supplied URLs (website checks). Team members can enter any
// address, so refuse anything that resolves to a private, loopback or link-local network
// to stop the server being used to probe internal systems (SSRF). Redirects are followed
// manually so every hop is checked.

const MAX_REDIRECTS = 5;

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function isBlockedV4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  return BLOCKED_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (ipv4ToInt(base) & mask);
  });
}

function isBlockedV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedV4(mapped[1]);
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(lower);
}

export function isBlockedAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isBlockedV4(ip);
  if (version === 6) return isBlockedV6(ip);
  return true;
}

function privateUrlsAllowed(): boolean {
  return process.env.COMPANION_ALLOW_PRIVATE_URLS === "true" && process.env.NODE_ENV !== "production";
}

export class BlockedUrlError extends Error {}

async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new BlockedUrlError("Only http(s) addresses can be checked");
  if (privateUrlsAllowed()) return;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new BlockedUrlError("Private addresses can't be checked");
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
    throw new BlockedUrlError("Private addresses can't be checked");
  }
}

/**
 * GET a public URL with a total timeout, following up to five redirects. Resolves when
 * response headers arrive; the body is discarded.
 */
export async function fetchPublicUrl(rawUrl: string, timeoutMs: number): Promise<Response> {
  const signal = AbortSignal.timeout(timeoutMs);
  let url = new URL(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal,
      cache: "no-store",
      headers: { "User-Agent": "PriinteveCompanion/1.0 (+uptime check)", Accept: "text/html,*/*" },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel().catch(() => undefined);
      url = new URL(location, url);
      continue;
    }
    await res.body?.cancel().catch(() => undefined);
    return res;
  }
  throw new Error("Too many redirects");
}
