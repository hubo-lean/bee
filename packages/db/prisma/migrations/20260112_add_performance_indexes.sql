-- Performance indexes for Story 7.1
-- These indexes optimize the most common query patterns

-- Composite index for common inbox queries (user + status + created)
-- This covers queries that filter by userId and status, then order by createdAt
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inbox_item_user_status_created
ON "InboxItem" ("userId", "status", "createdAt");

-- Expression index for AI confidence filtering
-- Used by getNeedsReviewQueue to filter items with low confidence
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inbox_item_ai_confidence
ON "InboxItem" ((("aiClassification"->>'confidence')::float))
WHERE "aiClassification" IS NOT NULL;

-- Partial index for user feedback queries (disagreements queue)
-- Only indexes rows where userFeedback exists
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inbox_item_user_feedback_deferred
ON "InboxItem" ("userId")
WHERE "userFeedback" IS NOT NULL
  AND ("userFeedback"->>'deferredToWeekly')::boolean = true;

-- Index for auto-archive date queries (already exists in schema but adding if missing)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inbox_item_auto_archive
-- ON "InboxItem" ("autoArchiveDate")
-- WHERE "autoArchiveDate" IS NOT NULL;
