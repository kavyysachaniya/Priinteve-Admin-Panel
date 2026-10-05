import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { CompanionSettingsForm } from "@/components/companion/companion-settings-form";
import { CompanionDevices } from "@/components/companion/companion-devices";
import { GmailAccounts } from "@/components/companion/connected-accounts";
import { InstallerUpload } from "@/components/companion/installer-upload";
import { TeamPolicyForm } from "@/components/companion/team-policy-form";
import { SetupGuide } from "@/components/companion/setup-guide";
import { requirePermission } from "@/lib/auth/session";
import { roleHasPermission } from "@/lib/auth/permissions";
import {
  allowedSections,
  companionAppUrl,
  getCompanionSettings,
  getCompanionTeamPolicy,
  hasSavedCompanionSettings,
  integrationEnvStatus,
} from "@/lib/services/companion/settings";
import { listDevices } from "@/lib/services/companion/devices";
import { listGmailAccounts } from "@/lib/services/companion/accounts";
import { getInstallerInfo } from "@/lib/services/companion/installer";
import { isStorageConfigured } from "@/lib/services/storage";

export const metadata = { title: "Companion" };
export const dynamic = "force-dynamic";

// Fixed messages for the ?notice= codes set by the OAuth routes (never echo provider text).
const NOTICES: Record<string, { tone: "ok" | "error"; text: string }> = {
  gmail_connected: { tone: "ok", text: "Gmail connected. It appears in your next briefing." },
  gmail_cancelled: { tone: "error", text: "Gmail connection was cancelled." },
  gmail_failed: { tone: "error", text: "Couldn't connect Gmail. Please try again, and allow read access when Google asks." },
  gmail_not_allowed: { tone: "error", text: "Gmail isn't enabled for your role. Ask an admin." },
  google_not_configured: { tone: "error", text: "Gmail isn't set up on the server yet. Ask an admin to add the Google credentials." },
  encryption_not_configured: { tone: "error", text: "The server is missing COMPANION_ENCRYPTION_KEY, so accounts can't be connected yet." },
  oauth_state_mismatch: { tone: "error", text: "That sign-in link expired or didn't match. Please start the connection again." },
};

export default async function CompanionPage({ searchParams }: PageProps<"/companion">) {
  let user;
  try {
    user = await requirePermission("companion:use");
  } catch {
    redirect("/dashboard");
  }

  const { notice } = await searchParams;
  const noticeInfo = typeof notice === "string" ? NOTICES[notice] : undefined;

  const [settings, policy, devices, gmail, installer, settingsSaved] = await Promise.all([
    getCompanionSettings(user.id, user.name),
    getCompanionTeamPolicy(),
    listDevices(user.id),
    listGmailAccounts(user.id),
    getInstallerInfo(),
    hasSavedCompanionSettings(user.id),
  ]);
  const allowed = allowedSections(user.role, policy);
  const env = integrationEnvStatus();
  const isAdmin = user.role === "ADMIN";
  const canManage = roleHasPermission(user.role, "companion:manage");
  const storageConfigured = isStorageConfigured();
  const appUrl = companionAppUrl();
  const activeDevices = devices.filter((d) => !d.revokedAt);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Companion"
        description="Your morning briefing on the desktop: sites, Slack, email and today's tasks. Changes apply on the next briefing."
        className="mb-0"
        actions={
          installer ? (
            <Button variant="outline" asChild>
              <a href="/api/companion/installer">
                <Download className="size-4" /> Download for Windows
              </a>
            </Button>
          ) : undefined
        }
      />

      {noticeInfo && (
        <div
          role="status"
          className={
            noticeInfo.tone === "ok"
              ? "rounded-md border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm text-green-700 dark:text-green-400"
              : "rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          }
        >
          {noticeInfo.text}
        </div>
      )}

      <SetupGuide
        appUrl={appUrl}
        installerReady={!!installer}
        hasDevice={activeDevices.length > 0}
        deviceSeen={activeDevices.some((d) => d.lastSeenAt)}
        settingsSaved={settingsSaved}
        gmailAllowed={allowed.gmail}
        gmailConnected={gmail.some((a) => a.status === "CONNECTED")}
      />

      <CompanionDevices
        appUrl={appUrl}
        devices={devices.map((d) => ({
          id: d.id,
          name: d.name,
          createdAt: d.createdAt.toISOString(),
          lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
          revokedAt: d.revokedAt?.toISOString() ?? null,
        }))}
      />

      <div id="briefing-settings" className="scroll-mt-20">
        <CompanionSettingsForm defaultValues={settings} allowed={allowed} isAdmin={isAdmin} slackConfigured={env.slack} />
      </div>

      {allowed.gmail && (
        <GmailAccounts
          configured={env.google && env.encryption}
          accounts={gmail.map((a) => ({
            id: a.id,
            label: a.label,
            email: a.email,
            enabled: a.enabled,
            excludeFromProcessing: a.excludeFromProcessing,
            status: a.status,
          }))}
        />
      )}

      {canManage && (
        <InstallerUpload
          storageConfigured={storageConfigured}
          current={
            installer
              ? {
                  fileName: installer.fileName,
                  size: installer.size,
                  version: installer.version,
                  uploadedAt: installer.uploadedAt?.toISOString() ?? null,
                }
              : null
          }
        />
      )}

      {canManage && <TeamPolicyForm defaultValues={policy} />}
    </div>
  );
}
