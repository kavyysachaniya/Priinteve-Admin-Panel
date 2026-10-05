// Briefing window: renders the state pushed by the main process.
(() => {
  const bridge = window.companion;
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

  const stage = $("stage");
  const greeting = $("greeting");
  const summary = $("summary");
  const offline = $("offline");
  const sections = $("sections");
  const meta = $("meta");
  const btnOk = $<HTMLButtonElement>("btn-ok");
  const btnRemind = $<HTMLButtonElement>("btn-remind");
  const btnRefresh = $<HTMLButtonElement>("btn-refresh");

  const MARKS: Record<ItemStatus, string> = { ok: "✓", warn: "!", error: "✕", todo: "" };
  const MARK_LABELS: Record<ItemStatus, string> = { ok: "Healthy", warn: "Warning", error: "Broken", todo: "To do" };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let leaving = false;

  // ------------------------------------------------------------ click-through

  // The window ignores the mouse except over the bubble and the mascot.
  for (const el of document.querySelectorAll<HTMLElement>(".hit")) {
    el.addEventListener("mouseenter", () => bridge.setInteractive(true));
    el.addEventListener("mouseleave", () => bridge.setInteractive(false));
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

  function enter() {
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
    return row;
  }

  function renderBriefing(briefing: Briefing, source: string) {
    greeting.textContent = `${timeOfDayGreeting(briefing.greeting)}, ${briefing.ownerName}!`;
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
    else if (state.kind === "loading") renderLoading(state.attempt, state.total);
    else if (state.kind === "briefing") renderBriefing(state.briefing, state.source);
  });

  btnOk.addEventListener("click", () => leave(() => bridge.dismiss()));
  btnRemind.addEventListener("click", () => leave(() => bridge.remindLater()));
  btnRefresh.addEventListener("click", () => bridge.refresh());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") leave(() => bridge.dismiss());
  });

  bridge.ready();
})();
