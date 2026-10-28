import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, writeSync } from "node:fs";
import type { TimerOp } from "../shared/timer";

// Append-only log of timer actions that the server hasn't confirmed yet. Every action is written
// and fsynced here *before* the window shows it as done, so a crash, a power cut after the click
// or a shutdown can't lose it. Lines are JSON:
//   {"t":"op","op":{...}}       an action, in the order it was taken
//   {"t":"ack","opId":"..."}    the server answered it (applied, conflict or rejected)
// A torn last line (power lost mid-write) is ignored on load. Once nothing is pending the file is
// compacted to just the unanswered actions.

type Line = { t: "op"; op: TimerOp } | { t: "ack"; opId: string };

const COMPACT_AFTER_BYTES = 256 * 1024;

export class TimerJournal {
  private pendingOps: TimerOp[] = [];
  private bytes = 0;
  /** The file ends in a torn line: the next write must start on a fresh line. */
  private needsNewline = false;

  constructor(private readonly file: string) {
    this.load();
  }

  private load(): void {
    if (!existsSync(this.file)) return;
    const text = readFileSync(this.file, "utf8");
    this.bytes = Buffer.byteLength(text);
    this.needsNewline = text.length > 0 && !text.endsWith("\n");
    const acked = new Set<string>();
    const ops: TimerOp[] = [];
    for (const raw of text.split("\n")) {
      if (!raw.trim()) continue;
      let line: Line;
      try {
        line = JSON.parse(raw) as Line;
      } catch {
        continue; // torn write
      }
      if (line.t === "op" && line.op && typeof line.op.opId === "string") ops.push(line.op);
      else if (line.t === "ack" && typeof line.opId === "string") acked.add(line.opId);
    }
    const seen = new Set<string>();
    this.pendingOps = ops.filter((op) => !acked.has(op.opId) && !seen.has(op.opId) && seen.add(op.opId));
  }

  private appendLines(lines: Line[]): void {
    const data = (this.needsNewline ? "\n" : "") + lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
    const fd = openSync(this.file, "a");
    try {
      writeSync(fd, data);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    this.needsNewline = false;
    this.bytes += Buffer.byteLength(data);
  }

  /** Durably records an action. Throws if the disk write fails, so the caller can say so. */
  append(op: TimerOp): void {
    this.appendLines([{ t: "op", op }]);
    this.pendingOps.push(op);
  }

  pending(): TimerOp[] {
    return [...this.pendingOps];
  }

  /** Marks actions as answered by the server. */
  ack(opIds: string[]): void {
    const ids = new Set(opIds);
    if (ids.size === 0) return;
    this.appendLines([...ids].map((opId) => ({ t: "ack" as const, opId })));
    this.pendingOps = this.pendingOps.filter((op) => !ids.has(op.opId));
    if (this.pendingOps.length === 0 || this.bytes > COMPACT_AFTER_BYTES) this.compact();
  }

  /** Rewrites the file with only the unanswered actions (temp file + rename). */
  private compact(): void {
    const tmp = `${this.file}.tmp`;
    const data = this.pendingOps.map((op) => JSON.stringify({ t: "op", op } satisfies Line) + "\n").join("");
    const fd = openSync(tmp, "w");
    try {
      writeSync(fd, data);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmp, this.file);
    this.bytes = Buffer.byteLength(data);
  }
}
