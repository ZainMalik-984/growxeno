-- Order item updates thread: count, text and screenshots, like a chat (2026-11-11, owner request).

-- AlterEnum
ALTER TYPE "notification_event" ADD VALUE 'ORDER_ITEM_UPDATE_POSTED';

-- CreateTable
CREATE TABLE "order_item_updates" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "author_id" UUID,
    "author_label" VARCHAR(200) NOT NULL,
    "from_worker" BOOLEAN NOT NULL DEFAULT false,
    "body" VARCHAR(2000),
    "count_value" INTEGER,
    "previous_count" INTEGER,
    "image_paths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_item_updates_order_item_id_created_at_idx" ON "order_item_updates"("order_item_id", "created_at");

-- AddForeignKey
ALTER TABLE "order_item_updates" ADD CONSTRAINT "order_item_updates_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same lock-down as every other table (see 20260910123000_harden_public_schema).
ALTER TABLE "order_item_updates" ENABLE ROW LEVEL SECURITY;
