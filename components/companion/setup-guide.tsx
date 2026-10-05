import { CheckCircle2, Circle, CircleAlert } from "lucide-react";
import { CopyButton } from "@/components/companion/copy-button";
import { cn } from "@/lib/utils";

// Step-by-step setup shown at the top of the Companion page, with live status ticks.
// Team steps for everyone; the server checklist only for admins.

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
  server: {
    encryption: boolean;
    storage: boolean;
    slack: boolean;
    google: boolean;
    bucket: string | null;
  } | null;
}

export function SetupGuide(props: SetupGuideProps) {
  const { appUrl, server } = props;
  const teamSteps: StepState[] = [
    props.installerReady ? "done" : "blocked",
    props.deviceSeen ? "done" : "todo",
    props.settingsSaved ? "done" : "todo",
  ];
  if (props.gmailAllowed) teamSteps.push(props.gmailConnected ? "done" : "todo");
  const doneCount = teamSteps.filter((s) => s === "done").length;
  const firstOpen = teamSteps.findIndex((s) => s !== "done");

  const origin = (() => {
    try {
      return new URL(appUrl).origin;
    } catch {
      return appUrl;
    }
  })();
  const corsJson = JSON.stringify(
    [
      {
        AllowedOrigins: [origin, "http://localhost:3000"],
        AllowedMethods: ["PUT", "GET"],
        AllowedHeaders: ["content-type"],
        ExposeHeaders: ["ETag"],
        MaxAgeSeconds: 3000,
      },
    ],
    null,
    2,
  );
  const bucket = server?.bucket ?? "YOUR-BUCKET";
  const iamPolicy = JSON.stringify(
    {
      Version: "2012-10-17",
      Statement: [
        { Effect: "Allow", Action: "s3:*", Resource: [`arn:aws:s3:::${bucket}`, `arn:aws:s3:::${bucket}/*`] },
      ],
    },
    null,
    2,
  );

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
            {server && !server.google && (
              <p className="text-amber-700 dark:text-amber-400">The Google sign-in isn&apos;t configured on the server yet (see Server setup below).</p>
            )}
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

      {server && (
        <div className="mt-5 border-t pt-4">
          <h3 className="text-sm font-semibold">Server setup (admins)</h3>
          <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
            One-time setup in Vercel → Project → Settings → Environment Variables. Redeploy after adding variables.
          </p>
          <ol className="space-y-2">
            <Step number={1} title="Encryption key for connected accounts" state={server.encryption ? "done" : "todo"}>
              <p>
                Add <Mono>COMPANION_ENCRYPTION_KEY</Mono>: 32 random bytes in base64. Generate one with:
              </p>
              <CodeBlock value={`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`} />
              <p>
                <strong>Never change it later</strong>: every connected Gmail account would need reconnecting.
              </p>
            </Step>

            <Step number={2} title="File storage (AWS S3)" state={server.storage ? "done" : "todo"}>
              <p>
                Used for the desktop installer and for task attachments (images, PDF, Word, XML). Add{" "}
                <Mono>S3_BUCKET</Mono>, <Mono>S3_REGION</Mono>, <Mono>S3_ACCESS_KEY_ID</Mono> and <Mono>S3_SECRET_ACCESS_KEY</Mono>.
                Use these <Mono>S3_</Mono> names on Vercel, which reserves the <Mono>AWS_</Mono> ones.
              </p>
              <p>
                <strong>Allow this site in the bucket.</strong> In the S3 console → bucket → <strong>Permissions</strong> →{" "}
                <strong>Cross-origin resource sharing (CORS)</strong> → Edit, paste:
              </p>
              <CodeBlock value={corsJson} label="Bucket CORS" />
              <p>
                Give the access key&apos;s IAM user full access to the bucket (IAM → Users → the user → Add permissions →
                Create inline policy → JSON):
              </p>
              <CodeBlock value={iamPolicy} label="IAM policy" />
              <p>
                Files are stored under the <Mono>admin-panel/</Mono> prefix, so the bucket can be shared with other apps. Keep
                the bucket private (Block all public access on); downloads use 5-minute signed links.
              </p>
            </Step>

            <Step number={3} title="Slack bot (for the Slack errors section)" state={server.slack ? "done" : "todo"}>
              <ol className="list-decimal space-y-1 pl-5">
                <li>
                  Go to <a className="text-primary hover:underline" href="https://api.slack.com/apps" target="_blank" rel="noreferrer">api.slack.com/apps</a> → <strong>Create New App</strong> → From scratch → name it <Mono>Priinteve Companion</Mono>.
                </li>
                <li>
                  <strong>OAuth &amp; Permissions → Bot Token Scopes</strong>: add <Mono>channels:history</Mono> (and{" "}
                  <Mono>groups:history</Mono> for private channels).
                </li>
                <li>
                  <strong>Install to Workspace</strong>, copy the <Mono>xoxb-…</Mono> token into <Mono>SLACK_BOT_TOKEN</Mono>.
                </li>
                <li>Invite the bot to each channel the team may watch. Every team member can watch any channel the bot is in.</li>
              </ol>
            </Step>

            <Step number={4} title="Google sign-in (for Gmail)" state={server.google ? "done" : "todo"}>
              <ol className="list-decimal space-y-1 pl-5">
                <li>
                  In <a className="text-primary hover:underline" href="https://console.cloud.google.com" target="_blank" rel="noreferrer">Google Cloud Console</a>, create a project and enable the <strong>Gmail API</strong>.
                </li>
                <li>
                  <strong>OAuth consent screen</strong>: Internal for Google Workspace accounts, External otherwise. Add the scope{" "}
                  <Mono>gmail.readonly</Mono> only. In Testing mode, add each team member under <strong>Test users</strong>.
                </li>
                <li>
                  <strong>Credentials → Create OAuth client ID → Web application</strong>, with this authorised redirect URI:
                </li>
              </ol>
              <CodeBlock value={`${appUrl}/api/companion/google/callback`} label="Redirect URI" />
              <p>
                Copy the client ID and secret into <Mono>GOOGLE_CLIENT_ID</Mono> and <Mono>GOOGLE_CLIENT_SECRET</Mono>. Also set{" "}
                <Mono>APP_URL</Mono> to <Mono>{appUrl}</Mono>.
              </p>
              <p>
                Testing-mode apps make people reconnect Gmail every 7 days. Publishing the app (Google verification for External
                apps) removes that.
              </p>
            </Step>

            <Step number={5} title="Upload the installer for the team" state={props.installerReady ? "done" : "todo"}>
              <p>
                On a Windows PC with Node.js 20+, from the repository: <Mono>cd companion</Mono>, <Mono>npm install</Mono>,{" "}
                <Mono>npm run dist</Mono>. Then upload <Mono>companion/release/Priinteve-Companion-Setup-x.y.z.exe</Mono> under{" "}
                <strong>Desktop app installer</strong> below. Use <strong>Team access</strong> to choose what employees can use.
              </p>
            </Step>
          </ol>
        </div>
      )}
    </section>
  );
}
