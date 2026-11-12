-- Invited users stay inactive until they set a password (2026-11-12, owner request).

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "invite_pending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "invited_at" TIMESTAMPTZ(6);
