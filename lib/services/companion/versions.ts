// Pure helpers shared by the update endpoint and the offline tests.

const INSTALLER_NAME = /^Priinteve-Companion-Setup-(\d+\.\d+\.\d+)\.exe$/i;

/** Extracts x.y.z from `Priinteve-Companion-Setup-x.y.z.exe`, or null for any other name. */
export function versionFromInstallerName(fileName: string): string | null {
  return INSTALLER_NAME.exec(fileName.trim())?.[1] ?? null;
}

export function parseVersion(version: string): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** > 0 when a is newer than b, < 0 when older, 0 when equal; null if either isn't x.y.z. */
export function compareVersions(a: string, b: string): number | null {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

/** True only when `candidate` is strictly newer than `current` (never offers a downgrade). */
export function isNewerVersion(candidate: string, current: string): boolean {
  const c = compareVersions(candidate, current);
  return c !== null && c > 0;
}

export const SHA256_HEX = /^[a-f0-9]{64}$/;
