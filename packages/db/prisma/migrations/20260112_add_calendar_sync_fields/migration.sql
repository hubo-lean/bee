-- Migration: Add sync tracking fields to CalendarAccount
-- These fields support the n8n calendar sync workflow (Story 7.5)

-- Add syncEnabled field (default true for existing accounts)
ALTER TABLE "CalendarAccount"
ADD COLUMN IF NOT EXISTS "syncEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Add tokenExpired field (default false for existing accounts)
ALTER TABLE "CalendarAccount"
ADD COLUMN IF NOT EXISTS "tokenExpired" BOOLEAN NOT NULL DEFAULT false;

-- Add consecutiveFailures field (default 0 for existing accounts)
ALTER TABLE "CalendarAccount"
ADD COLUMN IF NOT EXISTS "consecutiveFailures" INTEGER NOT NULL DEFAULT 0;
