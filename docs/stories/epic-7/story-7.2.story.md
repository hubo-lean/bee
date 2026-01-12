# Story 7.2: Local AI Classification Service

## Status

Ready for Review

---

## Story

**As a** Bee user,
**I want** my inbox items to be automatically classified by AI,
**so that** I can quickly process and organize my captured thoughts.

---

## Acceptance Criteria

1. Inbox items are classified immediately after creation (< 3 seconds)
2. Classification uses direct OpenAI API (no n8n intermediary)
3. Classification returns: category, confidence, reasoning, extracted actions, tags
4. High-confidence items (≥0.6) are auto-filed
5. Low-confidence items remain in "needs review" queue
6. Failed classifications fall back to manual review (no blocking)
7. API key stored securely in environment variables

---

## Tasks / Subtasks

- [x] **Task 1: Create AI Classification Service** (AC: 1, 2, 3)
  - [x] 1.1 Create `ai-classification.service.ts`
  - [x] 1.2 Implement `classifyItem(itemId, content)` method
  - [x] 1.3 Implement `classifyBatch(items)` for bulk processing
  - [x] 1.4 Add classification prompt with JSON schema
  - [x] 1.5 Handle OpenAI API errors with retry logic

- [x] **Task 2: Integrate with Inbox Creation** (AC: 1, 4, 5, 6)
  - [x] 2.1 Update inbox router to trigger classification
  - [x] 2.2 Run classification asynchronously (non-blocking)
  - [x] 2.3 Update item status to "processing" during classification
  - [x] 2.4 Route items based on confidence threshold
  - [x] 2.5 Handle classification failures gracefully

- [x] **Task 3: Store Classification Results** (AC: 3)
  - [x] 3.1 Update InboxItem with aiClassification JSON
  - [x] 3.2 Store extractedActions array
  - [x] 3.3 Store tags array
  - [x] 3.4 Record processing time and model used

- [x] **Task 4: Remove n8n Classification Dependency** (AC: 2)
  - [x] 4.1 Remove n8n webhook trigger from inbox creation
  - [x] 4.2 Update health check to not require n8n for classification
  - [x] 4.3 Keep n8n client for complex workflows only

- [x] **Task 5: Testing**
  - [x] 5.1 Test classification with various content types
  - [x] 5.2 Test confidence threshold routing
  - [x] 5.3 Test error handling and fallback
  - [x] 5.4 Test batch classification
  - [x] 5.5 Measure classification latency

---

## Dev Notes

### Task 1: AI Classification Service

**File:** `apps/web/src/server/services/ai-classification.service.ts`

The service provides:
- Direct OpenAI integration using `gpt-4o-mini` model
- Classification prompt optimized for productivity categories
- Retry logic with exponential backoff (3 attempts)
- User context injection (areas, projects) for better classification
- Content truncation for large inputs (4000 chars max)
- Result normalization and validation

Key features:
- `classifyItem(itemId, content, context)` - Classify single item
- `classifyBatch(items, context)` - Batch processing with concurrency control
- `reclassifyItem(itemId)` - Re-classify existing item
- `getUserContext(userId)` - Fetch areas/projects for context
- Static methods: `isConfigured()`, `testConnection()`

### Task 2: Integration with Inbox Router

**File:** `apps/web/src/server/routers/inbox.ts`

Changes:
- Import `aiClassificationService` instead of `n8nService`
- Create items with `status: "processing"`
- Call `getUserContext()` then `classifyItem()` asynchronously
- Non-blocking: errors are caught and logged, item falls back to pending
- Added `reclassify` mutation for manual re-classification

### Task 4: Remove n8n Dependency

**Files modified:**
- `apps/web/src/app/api/health/route.ts` - Added OpenAI health check
- `apps/web/src/lib/services/n8n.ts` - Marked classification methods as deprecated

**New flow:**
```
Create Item → Call OpenAI directly → Update Item
```

**Previous flow (deprecated):**
```
Create Item → POST to n8n → n8n calls OpenAI → n8n POSTs callback → Update Item
```

n8n is now optional and only used for complex workflows (calendar sync, etc.)

---

## Testing

### Unit Tests

**File:** `apps/web/src/server/services/__tests__/ai-classification.service.test.ts`

Test coverage:
- `isConfigured()` - API key presence detection
- `classifyItem()` - Single item classification
- Context inclusion in prompts
- Content truncation
- Category-specific classification (action, note, meeting)
- Response normalization (malformed data handling)
- Retry on API errors
- `classifyBatch()` - Multiple items with partial failures
- `getUserContext()` - Fetching user areas/projects
- `testConnection()` - OpenAI connectivity check

All 116 tests passing.

### Manual Testing Checklist

1. [x] Create text capture → classified in < 3 seconds
2. [x] Create voice capture → classified with transcription
3. [x] High confidence item → auto-filed
4. [x] Low confidence item → appears in review queue
5. [x] API error → item remains reviewable (not stuck)
6. [x] Reclassify button works
7. [x] Classification shows in item detail

---

## Definition of Done

- [x] AI classification service created
- [x] Direct OpenAI integration working
- [x] Inbox items classified on creation
- [x] Confidence-based routing implemented
- [x] Error handling prevents blocking
- [x] n8n no longer required for classification
- [x] Tests passing (116/116)
- [x] Documentation updated

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5

### Debug Log References
N/A

### Completion Notes
- Created comprehensive AI classification service with OpenAI integration
- Implemented async classification with retry logic and exponential backoff
- Updated inbox router to use direct OpenAI instead of n8n webhooks
- Added OpenAI health check to /api/health endpoint
- Marked n8n classification methods as deprecated (kept for backwards compatibility)
- Added reclassify mutation for manual re-classification
- Created comprehensive test suite (15 tests for ai-classification service)

### File List
- `apps/web/src/server/services/ai-classification.service.ts` (new)
- `apps/web/src/server/services/__tests__/ai-classification.service.test.ts` (new)
- `apps/web/src/server/routers/inbox.ts` (modified)
- `apps/web/src/app/api/health/route.ts` (modified)
- `apps/web/src/lib/services/n8n.ts` (modified - deprecation notes)

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-12 | 1.0 | Initial story - n8n classification workflow | John (PM) |
| 2026-01-12 | 2.0 | Complete rewrite - Local AI classification | John (PM) |
| 2026-01-12 | 2.1 | Implementation complete | James (Dev) |
