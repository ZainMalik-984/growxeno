import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireActor } from "@/lib/auth/authorize";
import { listTeam } from "@/lib/team/queries";
import { TeamPanel } from "./team-panel";

export const metadata: Metadata = { title: "My team" };

/**
 * An outsourced worker's own team (owner request, 2026-11-17): the one page
 * for it. Members are added and edited, and each member's work is viewed, in
 * popups; splitting a task happens in the Team popup on the Orders page.
 * Only for a signed-in outsourced worker; everyone else gets a 404.
 */
export default async function TeamPage() {
  const actor = await requireActor();
  if (!actor.outsourcedWorkerId) notFound();
  const members = await listTeam(actor);
  return <TeamPanel members={members} />;
}
