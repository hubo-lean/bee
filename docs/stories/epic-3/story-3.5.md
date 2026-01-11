# Story 3.5: Background Processing Queue

## Story

**As a** system,
**I want** to process inbox items in the background,
**So that** capture remains fast and users aren't blocked.

## Priority

**P0** - Critical for user experience

## Acceptance Criteria

1. New inbox items queued for AI processing
2. Background job processes queue continuously
3. Processing status shown on inbox items (pending, processing, complete, error)
4. Failed items retry automatically (up to 3 times)
5. Processing errors logged with details for debugging
6. Status transitions visible in real-time via polling/websocket
7. Queue metrics available for monitoring

## Technical Design

### Processing States

```typescript
type InboxItemStatus =
  | "pending"      // Awaiting classification
  | "processing"   // Currently being classified
  | "reviewed"     // Classification complete (auto-filed or manually reviewed)
  | "error"        // Classification failed after retries
  | "archived";    // User archived the item
```

### State Transitions

```
[CAPTURE]
    ↓
[pending] ──────────────────────────────────┐
    ↓ (triggerClassification)               │
[processing] ─────────────────┐             │
    ↓ (success)               ↓ (failure)   │
[reviewed] ←──────────────[pending]         │
                               ↓ (retry 3x) │
                            [error] ────────┘
                               ↓ (manual retry)
                            [pending]
```

### Queue Implementation Options

#### Option A: Database Polling (Simpler)
```typescript
// Cron job or n8n scheduler polls every 10 seconds
const pendingItems = await prisma.inboxItem.findMany({
  where: {
    status: "pending",
    aiClassification: null,
  },
  orderBy: { createdAt: "asc" },
  take: 10, // Batch size
});

for (const item of pendingItems) {
  await processItem(item);
}
```

#### Option B: n8n Webhook Trigger (Recommended)
```typescript
// Triggered immediately on capture
await fetch(`${N8N_WEBHOOK_URL}/classify-inbox-item`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Webhook-Secret": N8N_WEBHOOK_SECRET,
  },
  body: JSON.stringify({
    inboxItemId: item.id,
    userId: item.userId,
    content: item.content,
    source: item.source,
  }),
});

// Update status to processing
await prisma.inboxItem.update({
  where: { id: item.id },
  data: { status: "processing" },
});
```

### Retry Logic

```typescript
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 30000]; // 1s, 5s, 30s

async function processWithRetry(itemId: string, attempt = 0) {
  try {
    await triggerClassification(itemId);
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      // Schedule retry
      await prisma.inboxItem.update({
        where: { id: itemId },
        data: {
          status: "pending",
          processingMeta: {
            lastError: error.message,
            retryCount: attempt + 1,
            nextRetryAt: new Date(Date.now() + RETRY_DELAYS[attempt]),
          },
        },
      });

      // Log for monitoring
      logger.warn({ itemId, attempt, error }, "Classification retry scheduled");
    } else {
      // Max retries exceeded
      await prisma.inboxItem.update({
        where: { id: itemId },
        data: {
          status: "error",
          processingMeta: {
            lastError: error.message,
            retryCount: attempt,
            failedAt: new Date(),
          },
        },
      });

      // Create FailedWebhook record for monitoring
      await prisma.failedWebhook.create({
        data: {
          type: "classify",
          targetUrl: N8N_WEBHOOK_URL,
          payload: { itemId },
          error: error.message,
          retryCount: attempt,
          maxRetries: MAX_RETRIES,
          status: "failed",
        },
      });

      logger.error({ itemId, error }, "Classification failed after max retries");
    }
  }
}
```

### Real-Time Status Updates

```typescript
// tRPC subscription (or polling)
export const inboxRouter = router({
  watchStatus: protectedProcedure
    .input(z.object({ itemIds: z.array(z.string()) }))
    .query(async ({ ctx, input }) => {
      return prisma.inboxItem.findMany({
        where: {
          id: { in: input.itemIds },
          userId: ctx.session.user.id,
        },
        select: {
          id: true,
          status: true,
          aiClassification: true,
        },
      });
    }),
});

// Client-side polling (every 2 seconds while processing)
const { data, refetch } = api.inbox.watchStatus.useQuery(
  { itemIds: processingItemIds },
  {
    enabled: processingItemIds.length > 0,
    refetchInterval: 2000,
  }
);
```

### Processing Meta Schema

```typescript
interface ProcessingMeta {
  startedAt?: Date;
  completedAt?: Date;
  lastError?: string;
  retryCount?: number;
  nextRetryAt?: Date;
  failedAt?: Date;
  processingTimeMs?: number;
}
```

### Queue Metrics

```typescript
export const inboxRouter = router({
  queueMetrics: protectedProcedure.query(async ({ ctx }) => {
    const [pending, processing, error, total] = await Promise.all([
      prisma.inboxItem.count({
        where: { userId: ctx.session.user.id, status: "pending" },
      }),
      prisma.inboxItem.count({
        where: { userId: ctx.session.user.id, status: "processing" },
      }),
      prisma.inboxItem.count({
        where: { userId: ctx.session.user.id, status: "error" },
      }),
      prisma.inboxItem.count({
        where: { userId: ctx.session.user.id },
      }),
    ]);

    return { pending, processing, error, total };
  }),
});
```

## UI Components

### Processing Status Indicator

```tsx
function ProcessingStatus({ status }: { status: string }) {
  const config = {
    pending: { icon: Clock, color: "text-gray-500", label: "Pending" },
    processing: { icon: Loader2, color: "text-blue-500", animate: true, label: "Processing" },
    reviewed: { icon: CheckCircle, color: "text-green-500", label: "Complete" },
    error: { icon: AlertCircle, color: "text-red-500", label: "Error" },
  }[status];

  return (
    <div className={`flex items-center gap-1 ${config.color}`}>
      <config.icon className={cn("h-4 w-4", config.animate && "animate-spin")} />
      <span className="text-xs">{config.label}</span>
    </div>
  );
}
```

### Error Item with Retry

```tsx
function ErrorItem({ item }: { item: InboxItem }) {
  const retryMutation = api.inbox.retryClassification.useMutation();

  return (
    <Card className="border-red-200">
      <CardContent>
        <p>{item.content}</p>
        <p className="text-sm text-red-600">
          Error: {item.processingMeta?.lastError}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => retryMutation.mutate({ id: item.id })}
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}
```

## n8n Webhook Configuration

### Request to n8n
```json
POST /webhook/classify-inbox-item
{
  "inboxItemId": "uuid",
  "userId": "uuid",
  "content": "item content...",
  "source": "manual|email|voice|image",
  "callbackUrl": "https://bee.domain.com/api/webhooks/classification-complete"
}
```

### Response from n8n
```json
POST /api/webhooks/classification-complete
{
  "inboxItemId": "uuid",
  "success": true,
  "classification": { ... },
  "extractedActions": [ ... ],
  "tags": [ ... ],
  "modelUsed": "claude-3-sonnet",
  "processingTimeMs": 2340
}
```

## Dependencies

- n8n running with classification workflow
- FailedWebhook model (from Story 1.2)
- InboxItem status field

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/web/src/server/services/inbox.service.ts` | Modify | Add queue logic |
| `apps/web/src/server/routers/inbox.ts` | Modify | Add queueMetrics, retryClassification |
| `apps/web/src/components/inbox/processing-status.tsx` | Create | Status indicator |
| `apps/web/src/components/inbox/error-item.tsx` | Create | Error display with retry |

## Testing Checklist

- [ ] New capture → status "pending" → triggers n8n
- [ ] During classification → status "processing"
- [ ] Classification success → status "reviewed"
- [ ] Classification failure → retry (up to 3x)
- [ ] Max retries exceeded → status "error"
- [ ] Manual retry works for error items
- [ ] Status updates visible in real-time (polling)
- [ ] FailedWebhook records created for monitoring

## Definition of Done

- [x] Immediate trigger on capture (not batch)
- [x] Status transitions work correctly
- [x] Retry logic with exponential backoff
- [x] Error items trackable and retryable
- [x] Real-time status updates via polling
- [x] Queue metrics available
- [x] FailedWebhook audit trail
- [x] TypeScript/ESLint pass

## Dev Agent Record

### Status
**Ready for Review**

### Agent Model Used
Claude Opus 4.5

### Tasks Completed
- [x] Add ProcessingMeta interface and MAX_RETRIES/RETRY_DELAYS constants
- [x] Update markClassificationFailed with retry logic and exponential backoff
- [x] Add markProcessingStarted method for status tracking
- [x] Add resetForRetry method for manual retry from error state
- [x] Create FailedWebhook record on final failure (after max retries)
- [x] Add inbox.queueMetrics tRPC procedure
- [x] Add inbox.watchStatus tRPC procedure for real-time polling
- [x] Add inbox.retryClassification tRPC mutation
- [x] Add inbox.errorItems tRPC query
- [x] Create ProcessingStatus UI component
- [x] Create ErrorItem UI component with retry button
- [x] Create ErrorItemsList component
- [x] Update tests for new retry logic (46 tests passing)

### File List
| File | Action | Status |
|------|--------|--------|
| `apps/web/src/server/services/classification.service.ts` | Modified | Complete |
| `apps/web/src/server/routers/inbox.ts` | Modified | Complete |
| `apps/web/src/components/inbox/processing-status.tsx` | Created | Complete |
| `apps/web/src/components/inbox/error-item.tsx` | Created | Complete |
| `apps/web/src/server/services/__tests__/classification.service.test.ts` | Modified | Complete |

### Debug Log References
None - implementation completed without blocking issues.

### Completion Notes
- ProcessingMeta interface: startedAt, completedAt, lastError, retryCount, nextRetryAt, failedAt, processingTimeMs
- MAX_RETRIES = 3 with exponential backoff delays: 1s, 5s, 30s
- markClassificationFailed returns { shouldRetry: boolean; nextRetryAt?: Date }
- After max retries, creates FailedWebhook record with status "failed"
- inbox.queueMetrics returns: pending, processing, error, reviewed, total counts
- inbox.watchStatus enables 2-second polling for processing items
- inbox.retryClassification allows manual retry from error state
- ProcessingStatus component shows icon/color for each status
- ErrorItem component shows error details with expandable view and retry button
- Test coverage: 46 tests passing
- TypeScript and ESLint passing

---

## QA Results

**QA Status: PASSED**

| Verification | Result |
|--------------|--------|
| `pnpm typecheck` | All 3 packages pass |
| `pnpm lint` | No ESLint warnings or errors |
| classification.service.ts | 370 lines with ProcessingMeta, retry logic |
| inbox.ts router | 343 lines with queueMetrics, watchStatus, retryClassification, errorItems |
| processing-status.tsx | 100 lines with 5 status states |
| error-item.tsx | 188 lines with expandable details and retry |

### ProcessingMeta Interface Verified
```typescript
interface ProcessingMeta {
  startedAt?: string;
  completedAt?: string;
  lastError?: string;
  retryCount?: number;
  nextRetryAt?: string;
  failedAt?: string;
  processingTimeMs?: number;
}
```

### Queue Constants Verified
- MAX_RETRIES = 3
- RETRY_DELAYS = [1000, 5000, 30000] // 1s, 5s, 30s exponential backoff

### Classification Service Methods Verified

**markClassificationFailed(inboxItemId, error, currentRetryCount)**
- Reads existing processingMeta from aiClassification JSON
- If retryCount < MAX_RETRIES: sets status="pending", increments retryCount, calculates nextRetryAt
- If retryCount >= MAX_RETRIES: sets status="error", creates FailedWebhook record in transaction
- Returns { shouldRetry: boolean; nextRetryAt?: Date }

**markProcessingStarted(inboxItemId)**
- Sets status="processing"
- Updates processingMeta.startedAt timestamp

**resetForRetry(inboxItemId)**
- Validates item exists and status="error"
- Resets to status="pending", clears error state (retryCount=0, lastError=null)

### tRPC Procedures Verified

**inbox.queueMetrics**
- Returns: { pending, processing, error, reviewed, total }
- Uses Promise.all for parallel count queries

**inbox.watchStatus**
- Input: itemIds (array of UUIDs)
- Returns: [{ id, status, category, confidence, error, retryCount }]
- For real-time polling of processing items

**inbox.retryClassification**
- Input: id (UUID)
- Validates ownership and status="error"
- Calls classificationService.resetForRetry()
- Triggers n8nService.triggerClassification()
- Returns { success, error? }

**inbox.errorItems**
- Input: limit (default 20)
- Returns error items with processingMeta extracted

### UI Components Verified

**ProcessingStatus**
- 5 status states: pending (gray), processing (blue, spinning), reviewed (green), error (red), archived (gray)
- Each has: icon, color, bgColor, animate flag, label
- ProcessingStatusIcon variant for compact display

**ErrorItem**
- Red border styling with AlertTriangle icon
- Shows: "Classification Failed", retry count, content preview, metadata
- Retry button with RotateCcw icon, spinning animation when pending
- Expandable details showing: lastError, failedAt, full content
- Invalidates errorItems, queueMetrics, list on successful retry

**ErrorItemsList**
- Loading skeleton (2 placeholders)
- Empty state: "No errors - All items processed successfully"
- Maps error items to ErrorItem components

### FailedWebhook Audit Trail Verified
- Created in transaction with status="error" update
- Includes: type="classify", targetUrl, payload (truncated content), error, retryCount, maxRetries, status="failed"

**QA Agent:** Claude Opus 4.5
**Date:** 2026-01-11

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-11 | 1.0 | Initial story specification | Bob (SM) |
| 2026-01-11 | 1.1 | Implementation complete | James (Dev) |
