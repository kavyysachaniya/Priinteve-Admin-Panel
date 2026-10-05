import { app, net } from "electron";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, rmSync } from "node:fs";
import { once } from "node:events";
import path from "node:path";
import type { UpdateInfo } from "../shared/briefing";

// Downloads the new installer to the temp folder, verifies its size and SHA-256 against what
// the panel announced, then runs it silently. Nothing is executed unless the checksum matches.

const MAX_BYTES = 500 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 20 * 60 * 1000;

export function updateFilePath(version: string): string {
  return path.join(app.getPath("temp"), `Priinteve-Companion-Update-${version}.exe`);
}

export async function downloadUpdate(info: UpdateInfo, onProgress: (percent: number) => void): Promise<string> {
  const file = updateFilePath(info.version);
  rmSync(file, { force: true });

  const res = await net.fetch(info.url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS), redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`The download failed (HTTP ${res.status}).`);

  const total = info.size ?? (Number(res.headers.get("content-length")) || 0);
  const hash = createHash("sha256");
  const out = createWriteStream(file);
  let received = 0;
  let lastPercent = -1;

  try {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_BYTES) throw new Error("The update file is larger than expected.");
      hash.update(value);
      if (!out.write(value)) await once(out, "drain");
      if (total > 0) {
        const percent = Math.min(99, Math.floor((received / total) * 100));
        if (percent !== lastPercent) {
          lastPercent = percent;
          onProgress(percent);
        }
      }
    }
    out.end();
    await once(out, "finish");
  } catch (err) {
    out.destroy();
    rmSync(file, { force: true });
    throw err;
  }

  if (info.size !== undefined && received !== info.size) {
    rmSync(file, { force: true });
    throw new Error("The downloaded file is the wrong size. Please try again.");
  }
  if (hash.digest("hex") !== info.sha256) {
    rmSync(file, { force: true });
    throw new Error("The downloaded file didn't pass the safety check, so it was deleted.");
  }
  onProgress(100);
  return file;
}

/** Starts the silent installer detached from this process; the caller then exits the app. */
export function launchInstaller(file: string): void {
  const child = spawn(file, ["/S"], { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}
