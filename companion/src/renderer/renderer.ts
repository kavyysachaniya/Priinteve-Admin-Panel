// Briefing window: renders the state pushed by the main process.
(() => {
  const bridge = window.companion;
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

  const stage = $("stage");
  const mascotEl = $("mascot");
  const greeting = $("greeting");
  const summary = $("summary");
  const offline = $("offline");
  const sections = $("sections");
  const meta = $("meta");
  const btnOk = $<HTMLButtonElement>("btn-ok");
  const btnRemind = $<HTMLButtonElement>("btn-remind");
  const btnRefresh = $<HTMLButtonElement>("btn-refresh");
  const btnStop = $<HTMLButtonElement>("btn-stop");
  const updateBox = $("update");
  const updateText = $("update-text");
  const updateBar = $("update-bar");
  const updateFill = $("update-fill");
  const updateActions = $("update-actions");
  const btnInstall = $<HTMLButtonElement>("btn-install");
  const btnLater = $<HTMLButtonElement>("btn-later");

  const MARKS: Record<ItemStatus, string> = { ok: "✓", warn: "!", error: "✕", todo: "" };
  const MARK_LABELS: Record<ItemStatus, string> = { ok: "Healthy", warn: "Warning", error: "Broken", todo: "To do" };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let leaving = false;
  // Docked = minimised: the bubble is hidden and the mascot peeks in from the screen edge.
  // Click it to open the briefing again; no tray icon or typing needed.
  let docked = false;

  // ------------------------------------------------------------ click-through

  // The window is click-through except over the mascot and the bubble. The main process watches
  // the cursor and needs to know where those are, so report their rectangles whenever they may
  // have moved (state changes, animations, resizes) and on a slow timer as a safety net.
  function reportHits() {
    const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
    const add = (node: HTMLElement) => {
      const r = node.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) rects.push({ x: r.left, y: r.top, w: r.width, h: r.height });
    };
    add($("mascot"));
    if (!docked) add($("bubble"));
    bridge.reportHits(rects);
  }
  stage.addEventListener("animationend", reportHits, true);
  stage.addEventListener("transitionend", reportHits, true);
  window.addEventListener("resize", reportHits);
  window.setInterval(reportHits, 250);

  // Right-click the mascot or the bubble for the same menu as the tray icon.
  for (const target of [$("mascot"), $("bubble")]) {
    target.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      bridge.showMenu();
    });
  }

  // ------------------------------------------------------------------ helpers

  function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function setMood(mood: Mood) {
    stage.dataset.mood = mood;
  }

  function dock() {
    if (docked) return;
    docked = true;
    leaving = false;
    stage.classList.remove("leaving", "entered", "happy-bounce");
    stage.classList.add("docked");
    mascotEl.title = "Click to open, drag to move";
    bridge.dockChanged(true);
    window.setTimeout(reportHits, 400);
  }

  function expand() {
    if (!docked) return;
    docked = false;
    // Slide out from the docked position instead of from off-screen.
    stage.style.setProperty("--slide-from", "var(--dock-offset)");
    stage.classList.remove("docked", "leaving", "entered", "happy-bounce");
    void stage.offsetWidth;
    stage.classList.add("entered");
    mascotEl.title = "Click to minimise, drag to move";
    bridge.dockChanged(false);
    window.setTimeout(reportHits, 800);
  }

  function enter() {
    // Already docked (a reminder or the tray asked for attention): open from the dock.
    if (docked) {
      expand();
      return;
    }
    // Already open: keep what's on screen instead of replaying the entrance.
    if (stage.classList.contains("entered") && !leaving) return;
    stage.style.setProperty("--slide-from", "160%");
    leaving = false;
    stage.classList.remove("leaving", "entered", "happy-bounce");
    // Force a reflow so the entrance animation replays every time the window is shown.
    void stage.offsetWidth;
    stage.classList.add("entered");
  }

  function leave(then: () => void) {
    if (leaving) return;
    leaving = true;
    bridge.setInteractive(false);
    stage.classList.remove("entered", "happy-bounce");
    stage.classList.add("leaving");
    window.setTimeout(then, reducedMotion.matches ? 160 : 420);
  }

  function timeOfDayGreeting(fallback: string) {
    if (fallback && fallback.toLowerCase() !== "good morning") return fallback;
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }

  function formatUpdated(iso: string) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  // ---------------------------------------------------------------- rendering

  function renderItem(item: BriefingItem) {
    const row = item.url ? el("button", "item") : el("div", "item");
    if (item.url) {
      const url = item.url;
      (row as HTMLButtonElement).type = "button";
      row.title = url;
      row.addEventListener("click", () => bridge.openUrl(url));
    }
    const mark = el("span", `mark ${item.status}`, MARKS[item.status]);
    mark.setAttribute("aria-label", MARK_LABELS[item.status]);
    mark.setAttribute("role", "img");
    const text = el("span", "item-text");
    text.append(el("span", "item-label", item.label));
    if (item.detail) text.append(el("span", "item-detail", item.detail));
    row.append(mark, text);
    if (!item.actions?.length) return row;

    // Task rows get small buttons: tick it done, start or stop its timer.
    const wrap = el("div", "item-row");
    const buttons = el("span", "item-actions");
    const note = el("span", "item-note");
    note.hidden = true;
    text.append(note);
    wrap.append(row, buttons);

    const taskId = item.taskId ?? "";
    const setNote = (message: string, ok: boolean) => {
      note.hidden = false;
      note.textContent = message;
      note.classList.toggle("error", !ok);
    };
    const add = (action: ItemAction, glyph: string, label: string, onDone: (message: string, btn: HTMLButtonElement) => void) => {
      const btn = el("button", "item-action", glyph);
      btn.type = "button";
      btn.title = label;
      btn.setAttribute("aria-label", label);
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        const result = await bridge.taskAction(action, taskId);
        btn.disabled = false;
        if (result.ok) onDone(result.message, btn);
        else setNote(result.message, false);
      });
      buttons.append(btn);
      return btn;
    };

    for (const action of item.actions) {
      if (action === "complete") {
        add("complete", "✓", "Mark as done", (message) => {
          row.classList.add("done");
          mark.className = "mark ok";
          mark.textContent = "✓";
          buttons.replaceChildren();
          setNote(message, true);
        });
      } else if (action === "start-timer") {
        add("start-timer", "▶", "Start the timer on this task", (message, btn) => {
          btn.disabled = true;
          btn.title = "Timer running";
          btn.classList.add("on");
          setNote(message, true);
        });
      } else {
        add("stop-timer", "■", "Stop the running timer", (message) => {
          buttons.replaceChildren();
          setNote(message, true);
        });
      }
    }
    return wrap;
  }

  function renderUpdate(state: UpdateViewState | null) {
    if (!state) {
      updateBox.hidden = true;
      return;
    }
    updateBox.hidden = false;
    updateText.classList.toggle("error", state.phase === "error");
    updateBar.hidden = state.phase !== "downloading";
    updateActions.hidden = state.phase === "downloading" || state.phase === "installing";
    btnInstall.textContent = state.phase === "error" ? "Try again" : "Install now";
    if (state.phase === "available") {
      updateText.textContent = `Update ${state.version} is available.`;
    } else if (state.phase === "downloading") {
      const percent = state.percent ?? 0;
      updateText.textContent = `Downloading update ${state.version}… ${percent}%`;
      updateFill.style.width = `${percent}%`;
    } else if (state.phase === "installing") {
      updateText.textContent = "Installing… the companion will restart in a moment.";
    } else {
      updateText.textContent = state.message ?? "The update failed. Please try again.";
    }
  }

  function renderBriefing(briefing: Briefing, source: string, mode: "briefing" | "reminder" | "update") {
    // Reminders and the update prompt use their own heading instead of "Good morning, <name>!".
    greeting.textContent =
      mode === "briefing" ? `${timeOfDayGreeting(briefing.greeting)}, ${briefing.ownerName}!` : briefing.greeting;
    btnRemind.hidden = mode !== "briefing";
    btnStop.hidden = mode !== "reminder";
    btnRefresh.hidden = mode === "update";
    summary.textContent = briefing.summary;

    if (briefing.offline) {
      offline.hidden = false;
      offline.textContent = briefing.offlineNote ?? "Offline. Some information may be out of date.";
    } else {
      offline.hidden = true;
    }

    sections.replaceChildren(
      ...briefing.sections
        .filter((s) => s.items.length > 0)
        .map((s) => {
          const section = el("section", "section");
          section.append(el("h2", undefined, s.title), ...s.items.map(renderItem));
          return section;
        }),
    );

    const parts = [`${briefing.mascotName}`];
    const updated = formatUpdated(briefing.generatedAt);
    if (updated) parts.push(`updated ${updated}`);
    if (source === "sample") parts.push("sample data");
    meta.textContent = parts.join(" · ");

    setMood(briefing.mood);
    if (briefing.mood === "happy" && stage.classList.contains("entered") && !reducedMotion.matches) {
      stage.classList.add("happy-bounce");
    }
    btnRefresh.disabled = false;
  }

  function renderLoading(attempt: number, total: number) {
    summary.textContent = attempt > 1 ? `Still connecting… (try ${attempt} of ${total})` : "Getting your briefing…";
    btnRefresh.disabled = true;
    if (!sections.childElementCount) setMood("neutral");
  }

  // ------------------------------------------------------------------- wiring

  bridge.onState((state) => {
    if (state.kind === "enter") enter();
    else if (state.kind === "leave") (docked ? expand : dock)();
    else if (state.kind === "loading") renderLoading(state.attempt, state.total);
    else if (state.kind === "briefing") renderBriefing(state.briefing, state.source, state.mode ?? "briefing");
  });

  // Click the mascot to minimise it to the screen edge, and click it there to open it again.
  // Press and drag to move it (it only moves along the right edge while minimised).
  mascotEl.title = "Click to minimise, drag to move";
  let drag: { id: number; x: number; y: number; moving: boolean } | null = null;
  let justDragged = false;
  mascotEl.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    mascotEl.setPointerCapture(e.pointerId);
    drag = { id: e.pointerId, x: e.screenX, y: e.screenY, moving: false };
  });
  mascotEl.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.screenX - drag.x;
    const dy = e.screenY - drag.y;
    if (!drag.moving) {
      if (Math.hypot(dx, dy) < 5) return;
      drag.moving = true;
      mascotEl.classList.add("dragging");
      bridge.dragStart();
    }
    bridge.dragMove(dx, dy);
  });
  const endDrag = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.moving) {
      bridge.dragEnd();
      mascotEl.classList.remove("dragging");
      justDragged = true; // the click that follows a drag shouldn't minimise
      window.setTimeout(() => {
        justDragged = false;
      }, 0);
      window.setTimeout(reportHits, 100);
    }
    drag = null;
  };
  mascotEl.addEventListener("pointerup", endDrag);
  mascotEl.addEventListener("pointercancel", endDrag);
  mascotEl.addEventListener("click", () => {
    if (!justDragged) (docked ? expand() : dock());
  });

  // Mascot size (small / medium / large) comes from the tray menu.
  bridge.onUi((ui) => {
    stage.dataset.size = ui.size;
    window.setTimeout(reportHits, 50);
  });
  bridge.onUpdate(renderUpdate);
  btnInstall.addEventListener("click", () => bridge.installUpdate());
  btnLater.addEventListener("click", () => bridge.laterUpdate());
  btnStop.addEventListener("click", () => {
    bridge.stopToday();
    dock();
  });
  btnOk.addEventListener("click", dock);
  btnRemind.addEventListener("click", () => {
    bridge.remindLater();
    dock();
  });
  btnRefresh.addEventListener("click", () => bridge.refresh());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") dock();
  });

  bridge.ready();
  reportHits();
})();
