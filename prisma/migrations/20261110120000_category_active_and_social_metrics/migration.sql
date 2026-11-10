-- Category active state and social-media metric types (2026-11-10, owner request).

-- AlterEnum
ALTER TYPE "ServiceMetricType" ADD VALUE IF NOT EXISTS 'FOLLOWERS';
ALTER TYPE "ServiceMetricType" ADD VALUE IF NOT EXISTS 'LIKES';
ALTER TYPE "ServiceMetricType" ADD VALUE IF NOT EXISTS 'COMMENTS';

-- AlterTable
ALTER TABLE "categories" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "services" ADD COLUMN "deactivated_by_category" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "categories_is_active_idx" ON "categories"("is_active");
