-- Screenshot requests on order item updates (2026-11-11, owner request): a worker asks
-- the team for screenshots; open until someone on the team answers it.

-- AlterTable
ALTER TABLE "order_item_updates" ADD COLUMN     "answers_request_id" UUID,
ADD COLUMN     "is_request" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resolved_at" TIMESTAMPTZ(6),
ADD COLUMN     "resolved_by_label" VARCHAR(200);

-- CreateIndex
CREATE INDEX "order_item_updates_is_request_resolved_at_idx" ON "order_item_updates"("is_request", "resolved_at");
