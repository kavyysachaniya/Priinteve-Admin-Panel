// The time tracker window. Everything it shows comes from the main process (timer view, banners,
// briefing); the clock here only redraws elapsed time from the session's timestamps each second.

(() => {
  const api = window.companion;
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

  const NEW_TASK = "__new__";
  let view: TimerView | null = null;
  let busy = false;
  let pendingSwitch: TimerActionInput | null = null;

  // ---------------------------------------------------------------- helpers

  function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function pad(n: number) {
    return String(n).padStart(2, "0");
  }

  function clock(seconds: number) {
    const s = Math.max(0, Math.floor(seconds));
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  }

  function timeOf(ms: number | string) {
    const d = new Date(ms);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function dateTimeOf(ms: number | string) {
    const d = new Date(ms);
    return d.toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  }

  function serverNow() {
    return Date.now() + (view?.clockOffsetMs ?? 0);
  }

  function worked(v: TimerView) {
    if (v.status !== "RUNNING" || v.segmentStartedAtMs === null) return v.closedSeconds;
    return v.closedSeconds + Math.max(0, Math.floor((serverNow() - v.segmentStartedAtMs) / 1000));
  }

  function setNote(message: string, ok: boolean) {
    const note = $("action-note");
    note.textContent = message;
    note.className = ok ? "note" : "note error";
    note.hidden = !message;
  }

  // ---------------------------------------------------------------- tabs

  function showTab(tab: "timer" | "today") {
    $("panel-timer").hidden = tab !== "timer";
    $("panel-today").hidden = tab !== "today";
    $("tab-timer").setAttribute("aria-selected", String(tab === "timer"));
    $("tab-today").setAttribute("aria-selected", String(tab === "today"));
  }

  $("tab-timer").addEventListener("click", () => showTab("timer"));
  $("tab-today").addEventListener("click", () => showTab("today"));
  $("btn-settings").addEventListener("click", () => api.openSettings());

  // ---------------------------------------------------------------- timer

  const SYNC_TEXT: Record<SyncState, string> = {
    synced: "Synced",
    pending: "Saving…",
    offline: "Offline",
    "signed-out": "Not signed in",
    unpaired: "Not connected",
  };

  function renderSync(v: TimerView) {
    const sync = $("sync");
    const pendingText = v.pendingOps > 0 ? ` · ${v.pendingOps} to sync` : "";
    sync.textContent = SYNC_TEXT[v.sync] + (v.sync === "pending" ? "" : pendingText);
    sync.dataset.state = v.sync;
    sync.title =
      v.sync === "offline"
        ? "The server can't be reached. Timer actions are saved on this PC and sync automatically."
        : v.sync === "signed-out"
          ? "This PC's device token was revoked. Pair it again in Settings; saved actions are kept."
          : v.lastSyncedAt
            ? `Last synced ${dateTimeOf(v.lastSyncedAt)}`
            : "";
  }

  function renderClock() {
    if (!view) return;
    $("clock").textContent = clock(worked(view));
  }

  function renderTimer(v: TimerView) {
    view = v;
    renderSync(v);
    const card = $("clock-card");
    card.dataset.status = v.status;
    const idle = v.status === "IDLE";
    $("clock-status").textContent = idle
      ? "Not tracking"
      : `${v.status === "RUNNING" ? "Running" : "Paused"}${v.unconfirmed ? " · saved on this PC" : ""}`;
    $("clock-project").textContent = idle ? "Pick a project and task below to start." : v.projectName ?? "Project";
    $("clock-task").textContent = idle ? "" : v.taskTitle ?? "";
    const meta: string[] = [];
    if (!idle && v.sessionStartedAtMs) meta.push(`Started ${timeOf(v.sessionStartedAtMs)}`);
    if (v.status === "PAUSED") meta.push("paused time isn't counted");
    $("clock-meta").textContent = meta.join(" · ");
    $<HTMLButtonElement>("btn-pause").hidden = v.status !== "RUNNING";
    $<HTMLButtonElement>("btn-resume").hidden = v.status !== "PAUSED";
    $<HTMLButtonElement>("btn-stop").hidden = idle;
    $("start-heading").textContent = idle ? "Start a timer" : "Switch to another task";
    $("btn-start").textContent = idle ? "Start timer" : "Switch task";
    renderClock();
    renderPicker(v);
    renderNotices(v);
  }

  function renderPicker(v: TimerView) {
    const projectSel = $<HTMLSelectElement>("pick-project");
    const keep = projectSel.value || v.projectId || "";
    projectSel.replaceChildren(
      ...v.projects.map((p) => {
        const o = el("option", undefined, p.code ? `${p.code} · ${p.name}` : p.name);
        o.value = p.id;
        return o;
      }),
    );
    if (v.projects.some((p) => p.id === keep)) projectSel.value = keep;
    const empty = v.projects.length === 0;
    $("start-empty").hidden = !empty || v.sync === "unpaired";
    projectSel.disabled = empty;
    renderTasks(v);
  }

  function renderTasks(v: TimerView) {
    const projectSel = $<HTMLSelectElement>("pick-project");
    const taskSel = $<HTMLSelectElement>("pick-task");
    const keep = taskSel.value;
    const project = v.projects.find((p) => p.id === projectSel.value);
    const options = (project?.tasks ?? []).map((t) => {
      const o = el("option", undefined, t.status === "IN_PROGRESS" ? `${t.title} (in progress)` : t.title);
      o.value = t.id;
      return o;
    });
    if (v.canCreateTasks && project) {
      const o = el("option", undefined, "+ New task…");
      o.value = NEW_TASK;
      options.push(o);
    }
    taskSel.replaceChildren(...options);
    if ([...taskSel.options].some((o) => o.value === keep)) taskSel.value = keep;
    taskSel.disabled = options.length === 0;
    $("new-task-field").hidden = taskSel.value !== NEW_TASK;
    $<HTMLButtonElement>("btn-start").disabled = !project || options.length === 0 || busy;
  }

  function renderNotices(v: TimerView) {
    const box = $("notices");
    box.replaceChildren(
      ...v.notices.map((n) => {
        const row = el("div", "notice");
        row.append(el("p", undefined, n.message));
        const btn = el("button", "link", "Dismiss");
        btn.type = "button";
        btn.addEventListener("click", () => api.dismissNotice(n.id));
        const review = el("button", "link", "Review in time history");
        review.type = "button";
        review.addEventListener("click", () => api.openPanelPage("timesheet"));
        const actions = el("div", "row-actions");
        actions.append(review, btn);
        row.append(actions);
        return row;
      }),
    );
    if (v.notices.length) box.prepend(el("h2", undefined, "Needs your attention"));
    box.hidden = v.notices.length === 0;
  }

  async function run(input: TimerActionInput) {
    if (busy) return;
    busy = true;
    setButtonsDisabled(true);
    try {
      const result = await api.timerAction(input);
      setNote(result.message === "Saved." ? "" : result.message, result.ok);
      if (result.ok && input.type === "START") $<HTMLInputElement>("new-task").value = "";
    } catch {
      setNote("Something went wrong. Please try again.", false);
    } finally {
      busy = false;
      setButtonsDisabled(false);
      if (view) renderTasks(view);
    }
  }

  function setButtonsDisabled(disabled: boolean) {
    for (const id of ["btn-pause", "btn-resume", "btn-stop", "btn-start", "btn-switch-yes"]) {
      $<HTMLButtonElement>(id).disabled = disabled;
    }
  }

  function startInput(): TimerActionInput | null {
    const projectId = $<HTMLSelectElement>("pick-project").value;
    const task = $<HTMLSelectElement>("pick-task").value;
    if (!projectId || !task) return null;
    if (task === NEW_TASK) {
      const title = $<HTMLInputElement>("new-task").value.trim();
      if (title.length < 2) {
        setNote("Type a title for the new task.", false);
        return null;
      }
      return { type: "START", projectId, newTaskTitle: title };
    }
    return { type: "START", projectId, taskId: task };
  }

  $("pick-project").addEventListener("change", () => view && renderTasks(view));
  $("pick-task").addEventListener("change", () => {
    $("new-task-field").hidden = $<HTMLSelectElement>("pick-task").value !== NEW_TASK;
  });
  $("btn-pause").addEventListener("click", () => void run({ type: "PAUSE" }));
  $("btn-resume").addEventListener("click", () => void run({ type: "RESUME" }));
  $("btn-stop").addEventListener("click", () => void run({ type: "STOP" }));
  $("btn-start").addEventListener("click", () => {
    const input = startInput();
    if (!input) return;
    if (view && view.status !== "IDLE") {
      // Switching never runs two timers: confirm, then the main process stops the first before starting.
      pendingSwitch = input;
      $("switch-confirm").hidden = false;
      return;
    }
    void run(input);
  });
  $("btn-switch-yes").addEventListener("click", () => {
    $("switch-confirm").hidden = true;
    if (pendingSwitch) void run(pendingSwitch);
    pendingSwitch = null;
  });
  $("btn-switch-no").addEventListener("click", () => {
    $("switch-confirm").hidden = true;
    pendingSwitch = null;
  });
  for (const link of document.querySelectorAll<HTMLButtonElement>("[data-page]")) {
    link.addEventListener("click", () => api.openPanelPage(link.dataset.page as "timesheet" | "tasks"));
  }

  setInterval(renderClock, 1000);

  // ---------------------------------------------------------------- banners

  function bannerButton(label: string, kind: Banner["kind"], choice: string, className = "btn small") {
    const btn = el("button", className, label);
    btn.type = "button";
    btn.addEventListener("click", async () => {
      for (const b of $("banner").querySelectorAll("button")) b.disabled = true;
      const result = await api.chooseBanner(kind, choice);
      if (!result.ok && result.message) {
        const p = el("p", "note error", result.message);
        $("banner").append(p);
      }
      for (const b of $("banner").querySelectorAll("button")) b.disabled = false;
    });
    return btn;
  }

  function renderBanner(banner: Banner | null) {
    const box = $("banner");
    box.replaceChildren();
    box.hidden = !banner;
    if (!banner) return;
    box.dataset.kind = banner.kind;
    const actions = el("div", "row-actions");

    if (banner.kind === "shutdown" && banner.phase === "ask") {
      box.append(
        el("h2", undefined, "Stop your timer before shutting down"),
        el("p", undefined, "Your Priinteve timer is still running. Stop your active task timer before shutting down this PC."),
      );
      actions.append(
        bannerButton("Return to Timer", "shutdown", "return"),
        bannerButton("Stop Timer and Continue", "shutdown", "stop", "btn primary small"),
      );
    } else if (banner.kind === "shutdown") {
      box.append(el("h2", undefined, banner.synced ? "Timer stopped" : "Timer stopped (saved on this PC)"), el("p", undefined, banner.message));
      actions.append(bannerButton("OK", "shutdown", "close", "btn primary small"));
    } else if (banner.kind === "quit") {
      box.append(
        el("h2", undefined, "Your timer is still running"),
        el("p", undefined, "Stop it before closing the time tracker, or keep the app running in the tray."),
      );
      actions.append(bannerButton("Cancel", "quit", "cancel"), bannerButton("Stop timer & quit", "quit", "stop-quit", "btn primary small"));
    } else {
      box.append(
        el("h2", undefined, "Was this timer interrupted?"),
        el(
          "p",
          undefined,
          `${banner.projectName}${banner.taskTitle ? ` · ${banner.taskTitle}` : ""} has been running since ${dateTimeOf(banner.startedAt)}, ` +
            `but this PC last confirmed it was active at ${dateTimeOf(banner.lastConfirmedAt)} (it may have been off, asleep or closed).`,
        ),
        el("p", "hint", "Nothing is changed until you choose. Your choice is recorded in the entry's history."),
      );
      actions.append(
        bannerButton("I was working, keep it", "recovery", "keep"),
        bannerButton(`Stop at ${timeOf(banner.lastConfirmedAt)}`, "recovery", "stop-last", "btn primary small"),
        bannerButton("Stop now", "recovery", "stop-now"),
      );
    }
    box.append(actions);
  }

  // ---------------------------------------------------------------- update

  function renderUpdate(state: UpdateViewState | null) {
    const box = $("update");
    box.hidden = !state;
    if (!state) return;
    const text = $("update-text");
    const bar = $("update-bar");
    $("update-actions").hidden = state.phase !== "available" && state.phase !== "error";
    bar.hidden = state.phase !== "downloading";
    $("update-fill").style.width = `${state.percent ?? 0}%`;
    text.textContent =
      state.phase === "available"
        ? `Version ${state.version} is ready to install.`
        : state.phase === "downloading"
          ? `Downloading ${state.version}… ${state.percent ?? 0}%`
          : state.phase === "installing"
            ? "Installing. The app will restart."
            : state.message ?? "The update failed.";
  }

  $("btn-install").addEventListener("click", () => api.installUpdate());
  $("btn-later").addEventListener("click", () => api.laterUpdate());

  // ---------------------------------------------------------------- today

  function renderItem(item: BriefingItem) {
    const row = el("li", "item");
    row.dataset.status = item.status;
    const text = el("div", "item-text");
    const label = el(item.url ? "button" : "span", item.url ? "item-label link" : "item-label", item.label);
    if (item.url) label.addEventListener("click", () => api.openUrl(item.url!));
    text.append(label);
    if (item.detail) text.append(el("span", "item-detail", item.detail));
    row.append(el("span", "dot"), text);

    if (item.taskId && item.actions?.length) {
      const actions = el("div", "item-actions");
      const labels: Record<ItemAction, string> = { complete: "Done", "start-timer": "Start", "stop-timer": "Stop" };
      for (const action of item.actions) {
        if (action === "start-timer" && item.running) continue;
        if (action === "stop-timer" && !item.running) continue;
        const btn = el("button", "btn tiny", labels[action]);
        btn.type = "button";
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          const result = await api.taskAction(action, item.taskId!);
          btn.disabled = false;
          if (!result.ok) text.append(el("span", "item-detail error", result.message));
        });
        actions.append(btn);
      }
      row.append(actions);
    }
    return row;
  }

  function renderToday(state: TodayState) {
    if (state.kind === "loading") {
      $("summary").textContent = "Loading your briefing…";
      return;
    }
    const b = state.briefing;
    $("greeting").textContent = b.greeting || "Today";
    $("summary").textContent = b.summary;
    const offline = $("offline");
    offline.textContent = b.offlineNote ?? "";
    offline.hidden = !b.offline;
    $("btn-stop-today").hidden = state.mode !== "reminder";
    $("sections").replaceChildren(
      ...b.sections.map((s) => {
        const sec = el("section", "section");
        sec.dataset.status = s.status;
        sec.append(el("h2", undefined, s.title));
        const list = el("ul", "items");
        list.append(...s.items.map(renderItem));
        sec.append(list);
        return sec;
      }),
    );
  }

  $("btn-refresh").addEventListener("click", () => api.refreshToday());
  $("btn-stop-today").addEventListener("click", () => {
    api.stopToday();
    $("btn-stop-today").hidden = true;
  });

  // ---------------------------------------------------------------- wire up

  api.onTimer(renderTimer);
  api.onBanner(renderBanner);
  api.onToday(renderToday);
  api.onTab(showTab);
  api.onUpdate(renderUpdate);
  api.ready();
})();
