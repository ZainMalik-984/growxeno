-- Worker deadlines and application settings (2026-11-03, owner request).
-- See prisma/schema/settings.prisma and the OrderItem.deadline doc comment.

-- CreateTable
CREATE TABLE "app_settings" (
    "key" VARCHAR(80) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_id" UUID,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "deadline_overridden" BOOLEAN NOT NULL DEFAULT false;

-- Data: default worker-deadline settings (editable in Settings → System).
-- Same values as DEFAULT_WORKER_DEADLINE_SETTINGS in src/lib/settings/worker-deadline.ts.
INSERT INTO "app_settings" ("key", "value")
VALUES (
    'worker_deadline_buffer',
    '{"defaultDays": 1, "tiers": [{"minLeadDays": 50, "bufferDays": 5}, {"minLeadDays": 10, "bufferDays": 4}]}'::jsonb
)
ON CONFLICT ("key") DO NOTHING;

-- Data: an item deadline that already exists was typed in by hand, so keep it.
UPDATE "order_items" SET "deadline_overridden" = true WHERE "deadline" IS NOT NULL;

-- Data: every other item gets its worker deadline from the order's deadline,
-- using the same rule as computeWorkerDeadline(): lead time = deadline minus
-- the order's creation time; the gap never exceeds half the lead time.
UPDATE "order_items" AS i
SET "deadline" = o."deadline" - LEAST(
        make_interval(days => CASE
            WHEN o."deadline" - o."created_at" >= interval '50 days' THEN 5
            WHEN o."deadline" - o."created_at" >= interval '10 days' THEN 4
            ELSE 1
        END),
        (o."deadline" - o."created_at") / 2
    )
FROM "orders" AS o
WHERE i."order_id" = o."id"
  AND i."deadline_overridden" = false
  AND o."deadline" IS NOT NULL
  AND o."deadline" > o."created_at";

UPDATE "order_items" AS i
SET "deadline" = o."deadline"
FROM "orders" AS o
WHERE i."order_id" = o."id"
  AND i."deadline_overridden" = false
  AND o."deadline" IS NOT NULL
  AND o."deadline" <= o."created_at";
