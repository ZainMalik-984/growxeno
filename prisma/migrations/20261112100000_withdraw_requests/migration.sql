-- "Can't continue" requests (2026-11-11, owner request): a worker gives up a task partway;
-- the team moves what's left to someone else. Existing requests are screenshot requests.

-- AlterTable
ALTER TABLE "order_item_updates" ADD COLUMN     "request_type" VARCHAR(20) NOT NULL DEFAULT 'SCREENSHOTS',
ADD COLUMN     "resolution_note" VARCHAR(300);
