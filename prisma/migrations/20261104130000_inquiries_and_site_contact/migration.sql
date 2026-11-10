-- Website inquiries and editable site contact details (2026-11-04, owner request).

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'CLOSED');

-- CreateTable
CREATE TABLE "inquiries" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "service" VARCHAR(120),
    "message" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "handled_by_id" UUID,
    "handled_at" TIMESTAMPTZ(6),
    "ip_hash" VARCHAR(64),
    "user_agent" VARCHAR(300),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inquiries_status_created_at_idx" ON "inquiries"("status", "created_at" DESC);
CREATE INDEX "inquiries_created_at_idx" ON "inquiries"("created_at" DESC);
CREATE INDEX "inquiries_ip_hash_created_at_idx" ON "inquiries"("ip_hash", "created_at");

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_handled_by_id_fkey" FOREIGN KEY ("handled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data: the contact details shown on the public home page (editable in Settings).
-- Same values as DEFAULT_SITE_CONTACT in src/lib/settings/site-contact.ts.
INSERT INTO "app_settings" ("key", "value")
VALUES ('site_contact', '{"email": "hello@growxeno.com", "phone": null, "whatsapp": null}'::jsonb)
ON CONFLICT ("key") DO NOTHING;
