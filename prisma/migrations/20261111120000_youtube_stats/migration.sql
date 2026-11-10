-- Public YouTube stats for order item links, with a reading history (2026-11-10, owner request).

-- CreateEnum
CREATE TYPE "StatSnapshotTrigger" AS ENUM ('INITIAL', 'MANUAL', 'SCHEDULED');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "stats_checked_at" TIMESTAMPTZ(6),
ADD COLUMN     "stats_error" VARCHAR(300),
ADD COLUMN     "stats_fetched_at" TIMESTAMPTZ(6),
ADD COLUMN     "stats_source_id" VARCHAR(64),
ADD COLUMN     "stats_source_kind" VARCHAR(16),
ADD COLUMN     "stats_title" VARCHAR(300);

-- CreateTable
CREATE TABLE "order_item_stat_snapshots" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "source_id" VARCHAR(64) NOT NULL,
    "trigger" "StatSnapshotTrigger" NOT NULL,
    "subscribers" BIGINT,
    "views" BIGINT,
    "likes" BIGINT,
    "comments" BIGINT,
    "triggered_by_id" UUID,
    "triggered_by_label" VARCHAR(200),
    "taken_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_stat_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_item_stat_snapshots_order_item_id_taken_at_idx" ON "order_item_stat_snapshots"("order_item_id", "taken_at");

-- CreateIndex
CREATE INDEX "order_items_stats_checked_at_idx" ON "order_items"("stats_checked_at");

-- AddForeignKey
ALTER TABLE "order_item_stat_snapshots" ADD CONSTRAINT "order_item_stat_snapshots_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Same lock-down as every other table (see 20260910123000_harden_public_schema).
ALTER TABLE "order_item_stat_snapshots" ENABLE ROW LEVEL SECURITY;

-- Data: refresh every 6 hours by default (editable in Settings).
-- Same value as DEFAULT_YOUTUBE_STATS_SETTINGS in src/lib/settings/youtube-stats.ts.
INSERT INTO "app_settings" ("key", "value")
VALUES ('youtube_stats', '{"enabled": true, "intervalHours": 6}'::jsonb)
ON CONFLICT ("key") DO NOTHING;
