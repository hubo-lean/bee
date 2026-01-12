# Epic 7: Implementation Checklist

## Overview

This checklist provides a step-by-step guide to implement performance optimizations, local AI classification, and Gmail sync for Bee. Follow in order - each section builds on the previous.

**Key Changes from Original Plan:**
- Classification moved to local backend (no n8n required)
- Gmail sync uses existing Google OAuth (no email forwarding)
- Performance fixes are top priority (P0)

---

## Phase 1: Performance Optimizations (Days 1-3)

### 1.1 Fix N+1 Query in Inbox Queues (CRITICAL)

- [ ] **Update inbox-queues.service.ts:**
  ```bash
  # File: apps/web/src/server/services/inbox-queues.service.ts
  ```
  - [ ] Replace `findMany` + JS filter with raw SQL query
  - [ ] Add database-level JSON filtering for confidence
  - [ ] Add LIMIT to prevent loading all items
  - [ ] Test with EXPLAIN ANALYZE

- [ ] **Verify improvement:**
  - Before: Loads ALL pending items
  - After: Only loads items matching criteria

### 1.2 Fix O(n²) Sorting in Review Router

- [ ] **Update review.ts:**
  ```bash
  # File: apps/web/src/server/routers/review.ts
  ```
  - [ ] Replace `.find()` inside `.map()` with Map lookup
  - [ ] Create Map from items array first
  - [ ] Use `itemMap.get(id)` for O(1) lookup

### 1.3 Batch Count Queries

- [ ] **Update inbox.ts queueMetrics:**
  ```bash
  # File: apps/web/src/server/routers/inbox.ts
  ```
  - [ ] Replace 5 separate `prisma.inboxItem.count()` calls
  - [ ] Use single `prisma.inboxItem.groupBy()` query
  - [ ] Parse result to match existing response format

### 1.4 Add Database Indexes

- [ ] **Create migration:**
  ```bash
  cd packages/db && pnpm prisma migrate dev --name add_performance_indexes
  ```

- [ ] **Add indexes in migration SQL:**
  ```sql
  -- Composite index for review queries
  CREATE INDEX CONCURRENTLY idx_inbox_item_user_status_created
  ON "InboxItem" ("userId", "status", "createdAt");

  -- Expression index for JSON confidence
  CREATE INDEX CONCURRENTLY idx_inbox_item_ai_confidence
  ON "InboxItem" ((("aiClassification"->>'confidence')::float))
  WHERE "aiClassification" IS NOT NULL;

  -- Auto-archive index
  CREATE INDEX CONCURRENTLY idx_inbox_item_auto_archive
  ON "InboxItem" ("autoArchiveDate")
  WHERE "autoArchiveDate" IS NOT NULL;
  ```

- [ ] Run migration in production

### 1.5 Implement Optimistic Updates

- [ ] **Update inbox-step.tsx:**
  ```bash
  # File: apps/web/src/components/weekly-review/inbox-step.tsx
  ```
  - [ ] Add `onMutate` handler to mutations
  - [ ] Cancel outgoing queries
  - [ ] Update cache optimistically
  - [ ] Add `onError` rollback
  - [ ] Keep `onSettled` invalidation

### 1.6 Parallelize Weekly Review Queries

- [ ] **Create combined endpoint:**
  - [ ] Add `getInboxStepData` procedure to weeklyReview router
  - [ ] Return `{ needsReview, disagreements, projects, areas }` in one call
  - [ ] Use `Promise.all` for parallel execution

- [ ] **Update InboxStep component:**
  - [ ] Use single `getInboxStepData` query
  - [ ] Remove 4 separate query hooks

### 1.7 Lazy Load Weekly Review Steps

- [ ] **Update weekly-review/page.tsx:**
  - [ ] Replace static imports with `dynamic()`
  - [ ] Add loading fallback components
  - [ ] Verify bundle size reduction with `next build`

### 1.8 Verify Performance Improvements

- [ ] **Run performance tests:**
  - [ ] Inbox page load < 500ms
  - [ ] Weekly review load < 1000ms
  - [ ] Swipe action < 200ms
  - [ ] No visible loading spinners for cached data

---

## Phase 2: Local AI Classification (Days 3-5)

### 2.1 Create AI Classification Service

- [ ] **Create service file:**
  ```bash
  # File: apps/web/src/server/services/ai-classification.service.ts
  ```

- [ ] **Implement core functionality:**
  - [ ] Import OpenAI client
  - [ ] Define classification prompt
  - [ ] Implement `classifyItem(itemId, content, context)`
  - [ ] Add retry logic with exponential backoff
  - [ ] Implement `classifyBatch(items)` for bulk processing

- [ ] **Verify OpenAI connection:**
  ```bash
  # Test API key works
  curl https://api.openai.com/v1/models \
    -H "Authorization: Bearer $OPENAI_API_KEY"
  ```

### 2.2 Integrate with Inbox Router

- [ ] **Update inbox.ts create mutation:**
  - [ ] Set initial status to `processing`
  - [ ] Fetch user areas/projects for context
  - [ ] Call `aiClassificationService.classifyItem()` asynchronously
  - [ ] Don't block response on classification

- [ ] **Add reclassify mutation:**
  - [ ] Verify item ownership
  - [ ] Update status to `processing`
  - [ ] Trigger re-classification

### 2.3 Remove n8n Dependency for Classification

- [ ] **Update n8n.ts:**
  - [ ] Keep `isN8nConfigured()` helper
  - [ ] Remove automatic classification trigger
  - [ ] n8n now only used for complex workflows

- [ ] **Update health check:**
  - [ ] OpenAI is required
  - [ ] n8n is optional (for calendar sync only)

### 2.4 Test Classification

- [ ] **Manual tests:**
  - [ ] Create text capture → classified in < 3 seconds
  - [ ] High confidence (≥0.6) → auto-filed to "reviewed"
  - [ ] Low confidence → stays in "pending" for review
  - [ ] API error → falls back to manual review

---

## Phase 3: Gmail Sync (Days 5-7)

### 3.1 Install Dependencies

- [ ] **Add googleapis:**
  ```bash
  cd apps/web && pnpm add googleapis
  ```

### 3.2 Update Google OAuth Scopes

- [ ] **Update auth.ts:**
  ```typescript
  // Add Gmail readonly scope
  scope: [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.readonly',
  ].join(' '),
  access_type: 'offline',
  prompt: 'consent',
  ```

- [ ] **Update callbacks:**
  - [ ] Persist `access_token` and `refresh_token` in JWT
  - [ ] Make tokens available in session (server-side only)

- [ ] **Test re-authentication:**
  - [ ] Sign out and sign in again
  - [ ] Verify Gmail scope is requested
  - [ ] Verify tokens are stored

### 3.3 Create Gmail Service

- [ ] **Create service file:**
  ```bash
  # File: apps/web/src/server/services/gmail.service.ts
  ```

- [ ] **Implement:**
  - [ ] `syncUnreadToInbox()` - fetch unread emails
  - [ ] `fetchMessage()` - get full message details
  - [ ] `extractBodyFromParts()` - parse multipart messages
  - [ ] `extractAttachments()` - get attachment metadata
  - [ ] Duplicate detection by messageId

### 3.4 Create Gmail Router

- [ ] **Create router file:**
  ```bash
  # File: apps/web/src/server/routers/gmail.ts
  ```

- [ ] **Implement:**
  - [ ] `syncInbox` mutation - trigger email sync
  - [ ] `getSyncStatus` query - connection status + last sync

- [ ] **Add to app router:**
  ```typescript
  gmail: gmailRouter,
  ```

### 3.5 Add UI Components

- [ ] **Create GmailSyncButton:**
  ```bash
  # File: apps/web/src/components/inbox/gmail-sync-button.tsx
  ```
  - [ ] Show connection status
  - [ ] Sync button with loading state
  - [ ] Success toast with count

- [ ] **Add to inbox page header**

### 3.6 Test Gmail Sync

- [ ] **Manual tests:**
  - [ ] Sign in with Google → sees Gmail permission
  - [ ] Click "Sync Gmail" → emails appear in inbox
  - [ ] Sync again → duplicates skipped
  - [ ] Synced emails → automatically classified
  - [ ] HTML emails → text extracted correctly

---

## Phase 4: Search Index Population (Days 7-8)

### 4.1 Hook Embedding into Classification

- [ ] **Update ai-classification.service.ts:**
  - [ ] After `storeClassification()`, call `indexForSearch()`
  - [ ] Build searchable content from item + classification
  - [ ] Call `searchIndexService.indexContent()`
  - [ ] Handle errors gracefully (don't block)

### 4.2 Verify Semantic Search

- [ ] **Test search service:**
  - [ ] Create inbox item
  - [ ] Wait for classification + indexing
  - [ ] Search with similar terms
  - [ ] Verify results ranked by similarity

### 4.3 Create Batch Reindex Endpoint

- [ ] **Create API route:**
  ```bash
  # File: apps/web/src/app/api/internal/reindex/route.ts
  ```
  - [ ] Add internal API secret validation
  - [ ] Find items without embeddings
  - [ ] Batch generate embeddings
  - [ ] Return progress stats

### 4.4 Test Search

- [ ] **Manual tests:**
  - [ ] Search finds items by meaning
  - [ ] Synonym search works (buy/purchase)
  - [ ] Search latency < 500ms
  - [ ] Filters work (type, project, area)

---

## Phase 5: n8n Calendar Sync (Days 8-9) - OPTIONAL

### 5.1 Keep Existing Calendar Sync Workflow

- [ ] Calendar sync remains in n8n (complex multi-account workflow)
- [ ] No changes needed if already working
- [ ] See story-7.5.story.md for full configuration

### 5.2 Add Daily Reindex Job

- [ ] **Create n8n workflow:**
  - [ ] Schedule trigger: Daily at 2am
  - [ ] HTTP request to `/api/internal/reindex`
  - [ ] Authentication with internal secret

---

## Final Verification

### Environment Variables

- [ ] **Required:**
  ```env
  OPENAI_API_KEY=sk-...
  GOOGLE_CLIENT_ID=...
  GOOGLE_CLIENT_SECRET=...
  DATABASE_URL=postgresql://...
  ```

- [ ] **Optional (for n8n calendar sync):**
  ```env
  N8N_WEBHOOK_URL=https://...
  N8N_WEBHOOK_SECRET=...
  INTERNAL_API_SECRET=...
  ```

### Services Working

- [ ] Page load under 500ms
- [ ] Classification completes in < 3 seconds
- [ ] Gmail sync creates inbox items
- [ ] Semantic search returns results
- [ ] No visible loading spinners for cached data

### Performance Targets Met

| Metric | Target | Actual |
|--------|--------|--------|
| Inbox page load | < 500ms | |
| Weekly review load | < 1000ms | |
| Swipe action | < 200ms | |
| Classification | < 3s | |
| Search | < 500ms | |

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| Slow inbox load | Verify indexes created, check query plan |
| Classification fails | Check OPENAI_API_KEY, verify API quota |
| Gmail sync error | Check OAuth scopes, verify tokens stored |
| Search no results | Check embeddings generated, run reindex |
| Token expired | Re-authenticate with Google |

---

## Sign-Off

| Phase | Completed | Date | Developer |
|-------|-----------|------|-----------|
| Phase 1: Performance | [ ] | | |
| Phase 2: Classification | [ ] | | |
| Phase 3: Gmail Sync | [ ] | | |
| Phase 4: Search Index | [ ] | | |
| Phase 5: Calendar (Optional) | [ ] | | |

**Epic 7 Complete:** [ ]

---

*Last Updated: 2026-01-12 v2.0*
