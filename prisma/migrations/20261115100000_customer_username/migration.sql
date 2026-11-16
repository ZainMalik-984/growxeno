-- Customer username (owner request, 2026-11-15): "a customer should also have a username,
-- by default the same as the name". Existing customers take their name.
ALTER TABLE "customers" ADD COLUMN "username" VARCHAR(160);
UPDATE "customers" SET "username" = "name" WHERE "username" IS NULL;
ALTER TABLE "customers" ALTER COLUMN "username" SET NOT NULL;
CREATE INDEX "customers_username_trgm_idx" ON "customers" USING GIN ("username" gin_trgm_ops);
