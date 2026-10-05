"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { updateCompanionTeamPolicyAction } from "@/lib/actions/companion";
import type { CompanionTeamPolicyValues } from "@/lib/validations/companion";

const OPTIONS: Array<{ key: keyof CompanionTeamPolicyValues; label: string; hint: string }> = [
  { key: "employeeWebsites", label: "Website checks", hint: "Employees can monitor websites" },
  { key: "employeeSlack", label: "Slack errors", hint: "Employees can watch Slack channels the bot is in" },
  { key: "employeeGmail", label: "Gmail", hint: "Employees can connect their own Gmail" },
];

export function TeamPolicyForm({ defaultValues }: { defaultValues: CompanionTeamPolicyValues }) {
  const router = useRouter();
  const [values, setValues] = useState(defaultValues);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const result = await updateCompanionTeamPolicyAction(values);
    setSaving(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Team settings saved");
    router.refresh();
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Team access</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Choose which sections employees can use in their own companion. Admins always have every section; tasks and the
          checklist are always on.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => (
          <label key={option.key} className="flex items-start gap-3 rounded-md border p-3">
            <Switch
              checked={values[option.key]}
              onCheckedChange={(checked) => setValues((v) => ({ ...v, [option.key]: checked }))}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="block text-xs text-muted-foreground">{option.hint}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save team access"}
        </Button>
      </div>
    </div>
  );
}
