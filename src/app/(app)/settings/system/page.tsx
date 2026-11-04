import type { Metadata } from "next";

import { Breadcrumbs, PageHeader } from "@/components/ui/page";
import { requirePermission } from "@/lib/auth/authorize";
import { getWorkerDeadlineSettings, getWorkerDeadlineSettingsMeta } from "@/lib/settings/queries";
import { WorkerDeadlineSettingsForm } from "./worker-deadline-settings-form";

export const metadata: Metadata = { title: "Settings" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default async function SystemSettingsPage() {
  const actor = await requirePermission("settings.view");
  const [settings, meta] = await Promise.all([getWorkerDeadlineSettings(), getWorkerDeadlineSettingsMeta()]);

  return (
    <>
      <Breadcrumbs items={[{ label: "Settings" }, { label: "System" }]} />
      <PageHeader title="Settings" description="Rules that apply across the whole application." />

      <WorkerDeadlineSettingsForm
        initial={settings}
        canEdit={actor.permissions.has("settings.edit")}
        lastSaved={meta.updatedAt ? `Last saved ${dateFormat.format(meta.updatedAt)} UTC${meta.updatedBy ? ` by ${meta.updatedBy}` : ""}` : null}
      />
    </>
  );
}
