-- Where a worker's new-task message goes (2026-11-11, owner request).

-- CreateEnum
CREATE TYPE "WorkerNotifyChannel" AS ENUM ('NONE', 'EMAIL', 'WHATSAPP', 'BOTH');

-- AlterTable
ALTER TABLE "outsourced_workers" ADD COLUMN     "notify_via" "WorkerNotifyChannel" NOT NULL DEFAULT 'BOTH';

