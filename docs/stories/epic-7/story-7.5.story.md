# Story 7.5: n8n Calendar Sync Workflow

## Status

Ready for Review

---

## Story

**As a** Bee user,
**I want** my calendar events to sync automatically,
**so that** I can see my schedule in weekly review and create time blocks.

---

## Acceptance Criteria

1. n8n workflow runs every 15 minutes via cron trigger
2. Workflow fetches calendar accounts needing sync from Bee
3. Events synced from Google Calendar, Microsoft Outlook, and CalDAV
4. Events upserted to CalendarEvent table (no duplicates)
5. Sync window covers next 30 days
6. Failed syncs logged and retried on next run
7. Calendar accounts with expired tokens flagged for re-auth

---

## Tasks / Subtasks

- [x] **Task 1: Create Internal API Endpoints** (AC: 2, 7)
  - [x] 1.1 Create `GET /api/internal/calendar-accounts` endpoint
  - [x] 1.2 Return accounts with sync enabled and valid tokens
  - [x] 1.3 Add internal API secret authentication
  - [x] 1.4 Create `POST /api/internal/calendar-accounts/:id/flag-expired` endpoint

- [x] **Task 2: Create Sync Endpoint** (AC: 3, 4, 5)
  - [x] 2.1 Create `POST /api/internal/sync-calendar/:accountId` endpoint
  - [x] 2.2 Implement Google Calendar event fetch
  - [x] 2.3 Implement Microsoft Graph event fetch (already exists)
  - [x] 2.4 Implement CalDAV event fetch (already exists)
  - [x] 2.5 Upsert events to database (already exists via calendarService)

- [x] **Task 3: Create n8n Workflow** (AC: 1)
  - [x] 3.1 Create workflow with Schedule Trigger (15 min)
  - [x] 3.2 Add HTTP Request to fetch accounts
  - [x] 3.3 Add Split Out for account iteration
  - [x] 3.4 Add HTTP Request to trigger sync per account
  - [x] 3.5 Add error handling with auth error detection

- [x] **Task 4: Token Refresh Handling** (AC: 7)
  - [x] 4.1 Detect expired tokens during sync
  - [x] 4.2 Attempt token refresh if refresh token available
  - [x] 4.3 Flag account as expired if refresh fails
  - [x] 4.4 Return requiresReauth flag in response

- [x] **Task 5: Error Handling** (AC: 6)
  - [x] 5.1 Log failed syncs with error details
  - [x] 5.2 Skip failed accounts, continue with others
  - [x] 5.3 Track consecutive failures per account
  - [x] 5.4 Disable sync after 5 consecutive failures

- [x] **Task 6: Testing**
  - [x] 6.1 Test Google Calendar client (14 tests)
  - [x] 6.2 Microsoft Calendar already tested
  - [x] 6.3 CalDAV already tested
  - [x] 6.4 Test expired token handling
  - [x] 6.5 Verify no duplicate events (upsert logic)

---

## Dev Notes

### Database Schema Updates

Added new fields to CalendarAccount model:

```prisma
model CalendarAccount {
  // ... existing fields ...

  // n8n sync workflow fields
  syncEnabled         Boolean @default(true)  // Enable/disable automatic sync
  tokenExpired        Boolean @default(false) // Flag for expired OAuth tokens
  consecutiveFailures Int     @default(0)     // Track consecutive sync failures
}
```

Migration: `20260112_add_calendar_sync_fields/migration.sql`

### Internal API Endpoints

#### GET /api/internal/calendar-accounts

Returns accounts that need syncing:
- `syncEnabled = true`
- `tokenExpired = false`
- `consecutiveFailures < 5`

#### POST /api/internal/calendar-accounts/:id/flag-expired

Flags an account as having an expired token. Called when sync fails due to auth errors.

#### POST /api/internal/sync-calendar/:accountId

Triggers a sync for a specific account:
- Validates account exists and is enabled
- Calls calendarService.syncCalendar()
- Resets consecutive failures on success
- Increments failures on error
- Returns `requiresReauth: true` for token errors

### Google Calendar Client Implementation

Fully implemented `google-client.ts` with:
- OAuth2 authentication via googleapis
- Token refresh when expired
- Event fetching with pagination
- All-day event support
- Attendee mapping
- Event creation and deletion

### n8n Workflow

Workflow JSON exported to `docs/n8n-workflows/calendar-sync-workflow.json`

Flow:
1. Schedule Trigger (every 15 minutes)
2. HTTP Request: Get calendar accounts
3. If: Has accounts?
4. Split Out: Extract accounts array
5. HTTP Request: Sync each account
6. If: Auth error?
7. HTTP Request: Flag expired (if auth error)
8. Code: Log results

Environment variables required:
- `BEE_API_URL`: Base URL for Bee API
- `INTERNAL_API_SECRET`: Shared secret for internal APIs

---

## Testing

### Automated Tests

```bash
# Run all tests
pnpm test --run

# Tests: 157 passed
# New tests: 14 Google Calendar client tests
```

### Test Coverage

Google Calendar Client tests:
- Connect with valid OAuth token
- Handle missing access token
- Decrypt encrypted tokens
- Refresh expired token
- Handle expired token without refresh
- Fetch events for date range
- Handle all-day events
- Handle pagination
- Skip invalid events
- Map attendee response statuses
- Create event
- Delete event
- Disconnect clears state

### Manual Testing Checklist

1. [x] API endpoints return correct responses
2. [x] Internal secret authentication works
3. [x] Google Calendar events sync
4. [x] Microsoft Calendar events sync
5. [x] CalDAV events sync
6. [x] Expired token detected and flagged
7. [x] No duplicate events (upsert logic)
8. [x] Consecutive failures tracked

### Verification Queries

```sql
-- Check recent calendar events
SELECT ce.title, ce."startTime", ca.provider
FROM "CalendarEvent" ce
JOIN "CalendarAccount" ca ON ce."calendarAccountId" = ca.id
WHERE ce."createdAt" > NOW() - INTERVAL '1 hour'
ORDER BY ce."startTime";

-- Check accounts with expired tokens
SELECT id, name, provider, "tokenExpired", "consecutiveFailures"
FROM "CalendarAccount"
WHERE "tokenExpired" = true OR "consecutiveFailures" > 0;

-- Check sync status
SELECT id, name, provider, "syncEnabled", "syncStatus", "lastSyncAt"
FROM "CalendarAccount"
ORDER BY "lastSyncAt" DESC;
```

---

## Definition of Done

- [x] Internal API endpoints created and secured
- [x] n8n workflow JSON created (manual import required)
- [x] All three providers (Google, Microsoft, CalDAV) working
- [x] Events upserted without duplicates
- [x] Expired tokens detected and flagged
- [x] Error handling prevents cascade failures
- [x] Consecutive failures tracking implemented
- [x] Tests passing (157/157)
- [x] Documentation updated

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5

### Debug Log References
N/A

### Completion Notes
- Added syncEnabled, tokenExpired, consecutiveFailures fields to CalendarAccount schema
- Created internal API endpoints for n8n workflow integration
- Fully implemented Google Calendar client with googleapis
- Created n8n workflow JSON for calendar sync (15-minute schedule)
- Implemented consecutive failure tracking with auto-disable after 5 failures
- Added comprehensive test suite for Google Calendar client (14 tests)
- All 157 tests passing

### File List
- `packages/db/prisma/schema.prisma` (modified - added sync fields)
- `packages/db/prisma/migrations/20260112_add_calendar_sync_fields/migration.sql` (new)
- `apps/web/src/app/api/internal/calendar-accounts/route.ts` (new)
- `apps/web/src/app/api/internal/calendar-accounts/[id]/flag-expired/route.ts` (new)
- `apps/web/src/app/api/internal/sync-calendar/[accountId]/route.ts` (new)
- `apps/web/src/server/services/calendar/google-client.ts` (modified - full implementation)
- `apps/web/src/server/services/__tests__/google-calendar.test.ts` (new)
- `docs/n8n-workflows/calendar-sync-workflow.json` (new)

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-12 | 1.0 | Initial story creation | John (PM) |
| 2026-01-12 | 2.0 | Implementation complete | James (Dev) |
