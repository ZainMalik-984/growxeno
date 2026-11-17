-- An outsourced worker's own team and their split of order items (2026-11-17, owner request).
-- Private to the worker; see prisma/schema/team.prisma.
-- CreateEnum
CREATE TYPE "TeamShareStatus" AS ENUM ('PROCESSING', 'DONE');

-- CreateTable
CREATE TABLE "team_members" (
    "id" UUID NOT NULL,
    "outsourced_worker_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "whatsapp_number" VARCHAR(32),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_shares" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "team_member_id" UUID NOT NULL,
    "amount" INTEGER,
    "done" INTEGER NOT NULL DEFAULT 0,
    "status" "TeamShareStatus" NOT NULL DEFAULT 'PROCESSING',
    "note" VARCHAR(500),
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "team_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_members_outsourced_worker_id_is_active_idx" ON "team_members"("outsourced_worker_id", "is_active");

-- CreateIndex
CREATE INDEX "team_shares_team_member_id_idx" ON "team_shares"("team_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_shares_order_item_id_team_member_id_key" ON "team_shares"("order_item_id", "team_member_id");

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_outsourced_worker_id_fkey" FOREIGN KEY ("outsourced_worker_id") REFERENCES "outsourced_workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_shares" ADD CONSTRAINT "team_shares_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_shares" ADD CONSTRAINT "team_shares_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Same lock-down as every other table (see 20260910123000_harden_public_schema).
ALTER TABLE "team_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "team_shares" ENABLE ROW LEVEL SECURITY;
