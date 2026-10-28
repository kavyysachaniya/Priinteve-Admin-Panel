// Types for the API exposed by src/preload.ts, plus the contracts the window renders
// (mirror src/shared/briefing.ts and src/shared/timer.ts; renderer scripts are plain scripts without imports).

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

type TodayState =
  | { kind: "loading" }
  | { kind: "briefing"; briefing: Briefing; source: "live" | "cache" | "fallback" | "sample"; mode: "briefing" | "reminder" };

interface PickerProject {
  id: string;
  name: string;
  code: string | null;
  tasks: Array<{ id: string; title: string; status: string }>;
}

type SyncState = "synced" | "pending" | "offline" | "signed-out" | "unpaired";

interface TimerView {
  status: "IDLE" | "RUNNING" | "PAUSED";
  projectId: string | null;
  projectName: string | null;
  taskId: string | null;
  taskTitle: string | null;
  sessionStartedAtMs: number | null;
  segmentStartedAtMs: number | null;
  closedSeconds: number;
  clockOffsetMs: number;
  unconfirmed: boolean;
  sync: SyncState;
  pendingOps: number;
  lastSyncedAt: string | null;
  projects: PickerProject[];
  canCreateTasks: boolean;
  notices: Array<{ id: string; message: string }>;
}

type Banner =
  | { kind: "shutdown"; phase: "ask" }
  | { kind: "shutdown"; phase: "done"; synced: boolean; message: string }
  | { kind: "quit" }
  | { kind: "recovery"; projectName: string; taskTitle: string | null; startedAt: string; lastConfirmedAt: string; detectedAt: string };

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

type TimerActionInput =
  | { type: "START"; projectId: string; taskId?: string; newTaskTitle?: string }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "STOP" };

interface CompanionBridge {
  ready(): void;
  onTimer(callback: (view: TimerView) => void): () => void;
  onBanner(callback: (banner: Banner | null) => void): () => void;
  onToday(callback: (state: TodayState) => void): () => void;
  onTab(callback: (tab: "timer" | "today") => void): () => void;
  onUpdate(callback: (state: UpdateViewState | null) => void): () => void;
  timerAction(input: TimerActionInput): Promise<SettingsResult>;
  refreshTimer(): void;
  dismissNotice(id: string): void;
  chooseBanner(kind: Banner["kind"], choice: string): Promise<SettingsResult>;
  refreshToday(): void;
  stopToday(): void;
  taskAction(action: ItemAction, taskId: string): Promise<SettingsResult>;
  openUrl(url: string): void;
  openPanelPage(page: "timesheet" | "tasks" | "timer"): void;
  openSettings(): void;
  installUpdate(): void;
  laterUpdate(): void;
  getSettings(): Promise<{ serverUrl: string; hasToken: boolean } | null>;
  saveSettings(input: { serverUrl: string; token: string }): Promise<SettingsResult>;
  testConnection(input: { serverUrl: string; token: string }): Promise<SettingsResult>;
  openPanel(): void;
}

interface Window {
  companion: CompanionBridge;
}
