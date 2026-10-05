-- CreateEnum
CREATE TYPE "ServiceMetricType" AS ENUM ('VIEWS', 'SUBSCRIBERS', 'WATCH_HOURS');

-- AlterTable
ALTER TABLE "order_items" DROP COLUMN "selling_price",
DROP COLUMN "selling_price_currency",
ADD COLUMN     "channel_link" TEXT,
ADD COLUMN     "current_count" INTEGER,
ADD COLUMN     "target_count" INTEGER;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "metric_type" "ServiceMetricType";

