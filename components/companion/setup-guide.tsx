import { CheckCircle2, Circle, CircleAlert } from "lucide-react";
import { CopyButton } from "@/components/companion/copy-button";
import { cn } from "@/lib/utils";

// Step-by-step setup shown at the top of the Companion page, with live status ticks.
// Employee-side steps only (install, pair, personalise, Gmail). Server setup lives in docs/COMPANION.md.

type StepState = "done" | "todo" | "blocked";

function StateIcon({ state }: { state: StepState }) {
  if (state === "done") return <CheckCircle2 className="size-5 shrink-0 text-green-600 dark:text-green-400" aria-label="Done" />;
  if (state === "blocked") return <CircleAlert className="size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-label="Waiting on an admin" />;
  return <Circle className="size-5 shrink-0 text-muted-foreground" aria-label="To do" />;
}

function Step({
  number,
  title,
  state,
  open,
  children,
}: {
  number: number;
  title: string;
  state: StepState;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li>
      <details open={open} className="group rounded-md border">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
          <StateIcon state={state} />
          <span className={cn("flex-1 font-medium", state === "done" && "text-muted-foreground")}>
            {number}. {title}
          </span>
          <span className="text-xs text-muted-foreground group-open:hidden">Show steps</span>
          <span className="hidden text-xs text-muted-foreground group-open:inline">Hide</span>
        </summary>
        <div className="space-y-2 border-t px-4 py-3 text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground">
          {children}
        </div>
      </details>
    </li>
  );
}

function CodeBlock({ value, label }: { value: string; label?: string }) {
  return (
    <div className="rounded-md border bg-muted/50">
      <div className="flex items-center justify-between border-b px-3 py-1">
        <span className="text-xs text-muted-foreground">{label ?? ""}</span>
        <CopyButton value={value} />
      </div>
      <pre className="overflow-x-auto px-3 py-2 font-mono text-xs text-foreground">{value}</pre>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">{children}</span>;
}

export interface SetupGuideProps {
  appUrl: string;
  installerReady: boolean;
  hasDevice: boolean;
  deviceSeen: boolean;
  settingsSaved: boolean;
  gmailAllowed: boolean;
  gmailConnected: boolean;
}

export function SetupGuide(props: SetupGuideProps) {
  const { appUrl } = props;
  const teamSteps: StepState[] = [
    props.installerReady ? "done" : "blocked",
    props.deviceSeen ? "done" : "todo",
    props.settingsSaved ? "done" : "todo",
  ];
  if (props.gmailAllowed) teamSteps.push(props.gmailConnected ? "done" : "todo");
  const doneCount = teamSteps.filter((s) => s === "done").length;
  const firstOpen = teamSteps.findIndex((s) => s !== "done");

  return (
    <section className="rounded-lg border bg-card p-5" aria-labelledby="setup-guide-title">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="setup-guide-title" className="text-sm font-semibold">
            Setup guide
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Get your morning briefing running on your Windows computer. Ticks update as you go.
          </p>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {doneCount} of {teamSteps.length} done
        </span>
      </div>

      <ol className="space-y-2">
        <Step number={1} title="Install the desktop app" state={teamSteps[0]} open={firstOpen === 0}>
          {props.installerReady ? (
            <p>
              Click <strong>Download for Windows</strong> at the top of this page and run the installer. It installs for your
              Windows user only, with no admin rights needed.
            </p>
          ) : (
            <p>
              <strong>No installer has been uploaded yet.</strong> Ask an admin to upload it under <strong>Desktop app
              installer</strong> on this page.
            </p>
          )}
          <p>
            If Windows shows <strong>&quot;Windows protected your PC&quot;</strong>, click <strong>More info → Run anyway</strong>.
            The installer isn&apos;t code-signed yet, so Windows doesn&apos;t recognise it.
          </p>
          <p>
            When it finishes, a small blue ink-drop icon appears in the system tray (bottom-right, next to the clock; click
            <strong> ^</strong> if it&apos;s hidden). The app starts by itself every time you sign in to Windows.
          </p>
        </Step>

        <Step number={2} title="Pair your computer" state={teamSteps[1]} open={firstOpen === 1}>
          <p>
            Under <a href="#devices" className="font-medium text-primary hover:underline">Your computers</a> below, type a name
            (for example <Mono>Office desktop</Mono>) and click <strong>Create device token</strong>. Copy the token. It&apos;s
            shown only once.
          </p>
          <p>
            Right-click the ink-drop tray icon → <strong>Open settings</strong>, then enter the panel address and paste the
            token:
          </p>
          <CodeBlock value={appUrl} label="Panel address" />
          <p>
            Click <strong>Test connection</strong>, then <strong>Save</strong>. Right-click the icon → <strong>Show briefing now</strong>{" "}
            to check it.
            {props.hasDevice && !props.deviceSeen && (
              <> You&apos;ve created a token, but that computer hasn&apos;t fetched a briefing yet.</>
            )}
          </p>
        </Step>

        <Step number={3} title="Personalise your briefing" state={teamSteps[2]} open={firstOpen === 2}>
          <p>
            In <a href="#briefing-settings" className="font-medium text-primary hover:underline">the settings below</a>, set
            your name and greeting, add a morning checklist, and add the websites and Slack channels you want watched. Click{" "}
            <strong>Save companion settings</strong>.
          </p>
          <p>Changes apply on the next briefing. There&apos;s no need to reinstall or restart the app.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Websites:</strong> full addresses such as <Mono>https://priinteve.com</Mono>. Slower than 3 seconds shows as
              slow; no answer in 8 seconds shows as down.
            </li>
            <li>
              <strong>Slack:</strong> use the channel <em>ID</em>. Open the channel in Slack, click its name, and copy the ID at the
              bottom (it starts with <Mono>C</Mono>). The Priinteve bot must be invited to the channel (
              <Mono>/invite @Priinteve Companion</Mono>).
            </li>
            <li>
              <strong>Tasks:</strong> overdue, today&apos;s and tomorrow&apos;s open tasks from the planner appear
              automatically.
            </li>
          </ul>
        </Step>

        {props.gmailAllowed && (
          <Step number={4} title="Connect Gmail (optional)" state={teamSteps[3]} open={firstOpen === 3}>
            <p>
              Under <a href="#gmail" className="font-medium text-primary hover:underline">Gmail accounts</a>, type a label (for
              example <Mono>Work</Mono>) and click <strong>Connect Gmail</strong>. Sign in, and allow <strong>read</strong>{" "}
              access. Repeat for each account.
            </p>
            <p>
              The companion only reads. It never sends, deletes or changes mail. Turn on <strong>Private</strong> for an inbox
              to report its unread count only.
            </p>
          </Step>
        )}
      </ol>

      <details className="mt-4 rounded-md border bg-muted/30 px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium">Using the briefing day to day</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>The briefing appears about 6 seconds after you sign in to Windows, once a day.</li>
          <li>
            Marks: <strong className="text-green-600 dark:text-green-400">✓</strong> healthy,{" "}
            <strong className="text-amber-600 dark:text-amber-400">!</strong> needs a look,{" "}
            <strong className="text-red-600 dark:text-red-400">✕</strong> down or broken,{" "}
            <strong className="text-blue-600 dark:text-blue-400">○</strong> to do. Click any item to open it.
          </li>
          <li>
            <strong>Got it</strong> closes it, <strong>Remind me in 30 min</strong> brings it back later, and ⟳ fetches fresh
            data.
          </li>
          <li>Tray icon → <strong>Show briefing now</strong> any time; untick <strong>Start with Windows</strong> to stop autostart.</li>
          <li>Offline? You&apos;ll see the last briefing with an &quot;Offline&quot; note.</li>
          <li>Lost or replaced a computer? Click <strong>Revoke</strong> next to it under Your computers.</li>
        </ul>
      </details>
    </section>
  );
}
