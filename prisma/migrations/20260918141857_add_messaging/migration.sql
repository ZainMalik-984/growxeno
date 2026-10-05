/*
  Warnings:

  - Changed the type of `event_type` on the `notification_outbox` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "notification_event" AS ENUM ('ORDER_CREATED', 'ORDER_ASSIGNED', 'ORDER_PROCESSED', 'ORDER_STARTED', 'ORDER_COMPLETED', 'ORDER_REVISED', 'DEADLINE_24H', 'DEADLINE_6H', 'DEADLINE_TODAY', 'ORDER_OVERDUE', 'PAYMENT_DUE', 'ORDER_ITEM_STOP_WORK_REQUESTED');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('IN_APP', 'EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "message_status" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED');

-- NOTE (hand-edited, do not regenerate this line): Prisma's auto-generated
-- diff proposed `DROP INDEX "order_item_links_normalized_url_trgm_idx"` here.
-- That index is hand-added SQL Prisma's schema DSL cannot represent (see
-- docs/DATABASE.md's Migrations section) — every future migration will keep
-- proposing to drop it. Do not apply that drop.

-- AlterTable: convert event_type from free-text VarChar to the new
-- NotificationEvent enum WITHOUT dropping the two existing rows' values
-- (Prisma's naive diff would DROP + re-ADD the column, destroying data on a
-- NOT NULL column with existing rows — verified against the live project:
-- "order.processed" x22, "order_item.stop_work_requested" x7, all PENDING).
ALTER TABLE "notification_outbox" ADD COLUMN "event_type_new" "notification_event";

UPDATE "notification_outbox" SET "event_type_new" = CASE "event_type"
  WHEN 'order.processed' THEN 'ORDER_PROCESSED'::"notification_event"
  WHEN 'order_item.stop_work_requested' THEN 'ORDER_ITEM_STOP_WORK_REQUESTED'::"notification_event"
END;

ALTER TABLE "notification_outbox" ALTER COLUMN "event_type_new" SET NOT NULL;
ALTER TABLE "notification_outbox" DROP COLUMN "event_type";
ALTER TABLE "notification_outbox" RENAME COLUMN "event_type_new" TO "event_type";

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "type" "notification_event" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(6),
    "entity_type" VARCHAR(40),
    "entity_id" UUID,
    "action_url" VARCHAR(300),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "event" "notification_event" NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "subject" VARCHAR(200),
    "body" TEXT NOT NULL,
    "required_variables" TEXT[],
    "meta_template_name" VARCHAR(120),
    "meta_template_language" VARCHAR(10),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event" "notification_event" NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_logs" (
    "id" UUID NOT NULL,
    "recipient_id" UUID,
    "recipient_label" VARCHAR(160) NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "event" "notification_event" NOT NULL,
    "template_id" UUID,
    "provider_message_id" VARCHAR(200),
    "status" "message_status" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),

    CONSTRAINT "message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_recipient_id_is_read_created_at_idx" ON "notifications"("recipient_id", "is_read", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_event_channel_key" ON "notification_templates"("event", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_event_channel_key" ON "notification_preferences"("user_id", "event", "channel");

-- CreateIndex
CREATE INDEX "message_logs_status_created_at_idx" ON "message_logs"("status", "created_at");

-- CreateIndex
CREATE INDEX "message_logs_recipient_id_idx" ON "message_logs"("recipient_id");

-- CreateIndex
CREATE INDEX "message_logs_event_idx" ON "message_logs"("event");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
