import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page";
import { requireActor } from "@/lib/auth/authorize";
import { prisma } from "@/lib/db/prisma";
import { ProfileForms } from "./profile-forms";

export const metadata: Metadata = { title: "Profile" };

/**
 * The signed-in person's own profile (owner request, 2026-11-19): who they
 * are, change password, and for an outsourced worker, how they want to be
 * paid. Every signed-in user can open it; it only ever shows and changes
 * their own account.
 */
export default async function ProfilePage() {
  const actor = await requireActor();
  const worker = actor.outsourcedWorkerId
    ? await prisma.outsourcedWorker.findUnique({ where: { id: actor.outsourcedWorkerId }, select: { paymentDetails: true } })
    : null;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Profile" />
      <ProfileForms
        name={actor.user.fullName}
        email={actor.user.email}
        roles={actor.user.roleNames}
        paymentDetails={actor.outsourcedWorkerId ? (worker?.paymentDetails ?? "") : null}
      />
    </div>
  );
}
