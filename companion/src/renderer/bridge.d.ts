// Types for the API exposed by src/preload.ts, plus the briefing contract
// (mirrors src/shared/briefing.ts; renderer scripts are plain scripts without imports).

type ItemStatus = "ok" | "warn" | "error" | "todo";
type Mood = "happy" | "neutral" | "worried";

type ItemAction = "complete" | "start-timer" | "stop-timer";

interface BriefingItem {
  label: string;
  detail?: string;
  status: ItemStatus;
  url?: string;
  taskId?: string;
  actions?: ItemAction[];
  running?: boolean;
}

interface LiveView {
  timer: { taskId: string | null; projectName: string; startedAt: string } | null;
  tasks: Record<string, "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED">;
}

interface BriefingSection {
  key: string;
  title: string;
  status: ItemStatus;
  items: BriefingItem[];
}

interface Briefing {
  generatedAt: string;
  mascotName: string;
  ownerName: string;
  greeting: string;
  summary: string;
  mood: Mood;
  sections: BriefingSection[];
  offline?: boolean;
  offlineNote?: string;
}

type BriefingState =
  | { kind: "enter" }
  | { kind: "leave" }
  | { kind: "loading"; attempt: number; total: number }
  | { kind: "briefing"; briefing: Briefing; source: "live" | "cache" | "fallback" | "sample"; mode?: "briefing" | "reminder" | "update" };

interface UpdateViewState {
  phase: "available" | "downloading" | "installing" | "error";
  version: string;
  percent?: number;
  message?: string;
}

interface SettingsResult {
  ok: boolean;
  message: string;
}

interface CompanionBridge {
  onState(callback: (state: BriefingState) => void): () => void;
  ready(): void;
  dismiss(): void;
  remindLater(): void;
  refresh(): void;
  openUrl(url: string): void;
  showMenu(): void;
  dockChanged(docked: boolean): void;
  dragStart(): void;
  dragMove(dx: number, dy: number): void;
  dragEnd(): void;
  onUi(callback: (state: { size: "small" | "medium" | "large" }) => void): () => void;
  stopToday(): void;
  onUpdate(callback: (state: UpdateViewState | null) => void): () => void;
  installUpdate(): void;
  laterUpdate(): void;
  setInteractive(interactive: boolean): void;
  taskAction(action: ItemAction, taskId: string): Promise<SettingsResult>;
  watchTasks(ids: string[]): void;
  onLive(callback: (state: LiveView) => void): () => void;
  reportHits(rects: Array<{ x: number; y: number; w: number; h: number }>): void;
  getSettings(): Promise<{ serverUrl: string; hasToken: boolean } | null>;
  saveSettings(input: { serverUrl: string; token: string }): Promise<SettingsResult>;
  testConnection(input: { serverUrl: string; token: string }): Promise<SettingsResult>;
  openPanel(): void;
}

interface Window {
  companion: CompanionBridge;
}
