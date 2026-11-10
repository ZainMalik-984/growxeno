import { BadgePercent, Clock, Globe, Lock, Timer, TrendingUp, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { Breadcrumbs, PageHeader } from "@/components/ui/page";
import { requirePermission } from "@/lib/auth/authorize";
import { FIVERR_FEE_SETTING_KEY } from "@/lib/settings/fiverr-fee";
import { getYoutubeApiKey } from "@/lib/env";
import { getFiverrFeeSettings, getSettingMeta, getSiteContact, getWorkerDeadlineSettings, getYoutubeStatsSettings } from "@/lib/settings/queries";
import { formatInterval, YOUTUBE_STATS_SETTING_KEY } from "@/lib/settings/youtube-stats";
import { SITE_CONTACT_SETTING_KEY } from "@/lib/settings/site-contact";
import { WORKER_DEADLINE_SETTING_KEY } from "@/lib/settings/worker-deadline";
import { cn } from "@/lib/utils";
import { FiverrFeeForm } from "./fiverr-fee-form";
import { SiteContactForm } from "./site-contact-form";
import { WorkerDeadlineSettingsForm } from "./worker-deadline-settings-form";
import { YoutubeStatsForm } from "./youtube-stats-form";

export const metadata: Metadata = { title: "Settings" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/**
 * Settings, one section at a time (2026-11-04 redesign): a tab for every
 * setting, with its current value, along the top; the chosen section below. The section is in the URL (?section=…), so it can be linked to.
 * Add a new setting by adding an entry to SECTIONS and a branch below.
 */
const SECTIONS = [
  {
    key: "worker-deadlines",
    group: "Orders",
    label: "Worker deadlines",
    icon: Timer,
    description: "External workers get an earlier deadline than the order's, so there's time to check the work before delivery.",
  },
  {
    key: "youtube-stats",
    group: "Orders",
    label: "YouTube stats",
    icon: TrendingUp,
    description: "Public subscriber, view, like and comment counts read from YouTube for order item links, and how often they refresh.",
  },
  {
    key: "fiverr-fee",
    group: "Finance",
    label: "Fiverr fee",
    icon: BadgePercent,
    description: "What Fiverr keeps from each Fiverr order. Employee commission on Fiverr orders is worked out after this fee.",
  },
  {
    key: "contact",
    group: "Website",
    label: "Contact details",
    icon: Globe,
    description: "Email, phone, WhatsApp and social profiles shown on the public website.",
  },
] as const satisfies ReadonlyArray<{ key: string; group: string; label: string; icon: LucideIcon; description: string }>;

type SectionKey = (typeof SECTIONS)[number]["key"];

const searchSchema = z.object({
  section: z.enum(SECTIONS.map((s) => s.key) as [SectionKey, ...SectionKey[]]).catch("worker-deadlines"),
});

const savedLabel = (meta: { updatedAt: Date | null; updatedBy: string | null }) =>
  meta.updatedAt ? `Saved ${dateFormat.format(meta.updatedAt)} UTC${meta.updatedBy ? ` by ${meta.updatedBy}` : ""}` : null;

export default async function SystemSettingsPage({ searchParams }: PageProps<"/settings/system">) {
  const actor = await requirePermission("settings.view");
  const { section } = searchSchema.parse(await searchParams);
  const canEdit = actor.permissions.has("settings.edit");

  // The menu shows every setting's current value, so all of them load (two small reads each).
  const [deadlines, deadlinesMeta, fiverrFee, fiverrFeeMeta, contact, contactMeta, youtube, youtubeMeta] = await Promise.all([
    getWorkerDeadlineSettings(),
    getSettingMeta(WORKER_DEADLINE_SETTING_KEY),
    getFiverrFeeSettings(),
    getSettingMeta(FIVERR_FEE_SETTING_KEY),
    getSiteContact(),
    getSettingMeta(SITE_CONTACT_SETTING_KEY),
    getYoutubeStatsSettings(),
    getSettingMeta(YOUTUBE_STATS_SETTING_KEY),
  ]);
  const youtubeConnected = getYoutubeApiKey() !== null;

  const socialCount = [contact.whatsapp, contact.instagram, contact.twitter, contact.facebook].filter(Boolean).length;
  const summary: Record<SectionKey, string> = {
    "worker-deadlines": `${deadlines.defaultDays} ${deadlines.defaultDays === 1 ? "day" : "days"} early · ${deadlines.tiers.length} ${deadlines.tiers.length === 1 ? "rule" : "rules"}`,
    "youtube-stats": !youtubeConnected
      ? "Not connected"
      : youtube.enabled
        ? `Every ${formatInterval(youtube.intervalHours)}`
        : "Manual only",
    "fiverr-fee": `${fiverrFee.percent}% of Fiverr orders`,
    contact: socialCount > 0 ? `${contact.email} · ${socialCount} ${socialCount === 1 ? "link" : "links"}` : contact.email,
  };
  const meta: Record<SectionKey, string | null> = {
    "worker-deadlines": savedLabel(deadlinesMeta),
    "youtube-stats": savedLabel(youtubeMeta),
    "fiverr-fee": savedLabel(fiverrFeeMeta),
    contact: savedLabel(contactMeta),
  };
  const current = SECTIONS.find((s) => s.key === section)!;

  return (
    <>
      <Breadcrumbs items={[{ label: "Settings" }, { label: "System" }]} />
      <PageHeader title="Settings" description="Rules that apply across the whole application." />

      {/* Sections as tabs along the top (owner request, 2026-11-04). Each tab
          shows the setting's current value; the row scrolls on small screens. */}
      <nav aria-label="Settings sections" className="-mx-1 mb-6 overflow-x-auto px-1 pb-1">
        <ul className="flex min-w-max gap-1 border-b border-zinc-200/80">
          {SECTIONS.map((s) => {
            const active = s.key === section;
            return (
              <li key={s.key}>
                <Link
                  href={`/settings/system?section=${s.key}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group -mb-px flex items-center gap-2.5 border-b-2 px-3 pb-3 pt-1 transition-colors",
                    active ? "border-indigo-600" : "border-transparent hover:border-zinc-300",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-[8px] transition-colors",
                      active ? "bg-indigo-50 text-indigo-600" : "bg-zinc-100 text-zinc-500 group-hover:text-zinc-700",
                    )}
                  >
                    <s.icon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="text-left">
                    <span className={cn("block text-[13px] font-medium", active ? "text-zinc-900" : "text-zinc-600 group-hover:text-zinc-900")}>
                      {s.label}
                    </span>
                    <span className="block max-w-[220px] truncate text-xs text-zinc-500">{summary[s.key]}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0">
        <section aria-labelledby="settings-section-title" className="min-w-0">
          {/* Section header: what this setting is, when it was last saved, who can change it. */}
          <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200/80 pb-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-white text-indigo-600 shadow-[0_1px_2px_rgba(16,24,40,0.06)] ring-1 ring-inset ring-zinc-200/80">
                <current.icon aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{current.group}</p>
                <h2 id="settings-section-title" className="text-lg font-semibold tracking-[-0.01em] text-zinc-900">
                  {current.label}
                </h2>
                <p className="mt-0.5 max-w-2xl text-[13px] text-zinc-500">{current.description}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 text-xs text-zinc-500">
              {meta[section] ? (
                <span className="inline-flex items-center gap-1">
                  <Clock aria-hidden="true" className="size-3.5" />
                  {meta[section]}
                </span>
              ) : (
                <span>Using the defaults</span>
              )}
              {!canEdit ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600">
                  <Lock aria-hidden="true" className="size-3" />
                  View only
                </span>
              ) : null}
            </div>
          </header>

          {section === "worker-deadlines" ? (
            <WorkerDeadlineSettingsForm initial={deadlines} canEdit={canEdit} />
          ) : section === "youtube-stats" ? (
            <div className="max-w-2xl">
              <YoutubeStatsForm initial={youtube} canEdit={canEdit} apiKeyConfigured={youtubeConnected} />
            </div>
          ) : section === "fiverr-fee" ? (
            <div className="max-w-2xl">
              <FiverrFeeForm initial={fiverrFee} canEdit={canEdit} />
            </div>
          ) : (
            <SiteContactForm initial={contact} canEdit={canEdit} />
          )}
        </section>
      </div>
    </>
  );
}
