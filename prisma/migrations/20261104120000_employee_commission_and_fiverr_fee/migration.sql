-- Employee commission and the Fiverr fee setting (2026-11-04, owner request).

-- AlterTable
ALTER TABLE "users" ADD COLUMN "commission_percent" DECIMAL(5,2);

-- Data: the Fiverr fee taken from each Fiverr order (editable in Settings).
-- Same value as DEFAULT_FIVERR_FEE_SETTINGS in src/lib/settings/fiverr-fee.ts.
INSERT INTO "app_settings" ("key", "value")
VALUES ('fiverr_fee', '{"percent": 20}'::jsonb)
ON CONFLICT ("key") DO NOTHING;
