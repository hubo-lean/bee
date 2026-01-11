# Story 3.4: Bouncer System (Confidence Routing)

## Story

**As a** user,
**I want** low-confidence items routed to a review queue,
**So that** I can validate uncertain AI decisions.

## Priority

**P0** - Critical for user trust and system accuracy

## Acceptance Criteria

1. Items with confidence < 0.6 automatically flagged "Needs Review"
2. High-confidence items (>= 0.6) auto-filed with receipt notification
3. Receipt shows: "Filed as [Category]. Confidence: [Score]"
4. Receipts accessible in dedicated "Receipts" tab for spot-checking
5. Confidence threshold configurable in settings
6. Status transitions logged in ClassificationAudit
7. Needs Review count visible in navigation badge

## Technical Design

### Confidence Routing Logic

```typescript
async function routeByConfidence(
  inboxItemId: string,
  classification: AIClassification,
  userId: string
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  });

  const threshold = user?.settings?.confidenceThreshold ?? 0.6;

  if (classification.confidence >= threshold) {
    // High confidence: auto-file
    await prisma.inboxItem.update({
      where: { id: inboxItemId },
      data: {
        status: "reviewed",
        reviewedAt: new Date(),
      },
    });

    // Create receipt notification
    await createReceipt(inboxItemId, classification);

    return { routed: "auto-filed", status: "reviewed" };
  } else {
    // Low confidence: needs review
    await prisma.inboxItem.update({
      where: { id: inboxItemId },
      data: {
        status: "pending", // Remains pending for manual review
      },
    });

    return { routed: "needs-review", status: "pending" };
  }
}
```

### Receipt Structure

```typescript
interface Receipt {
  id: string;
  inboxItemId: string;
  userId: string;
  category: string;
  confidence: number;
  reasoning: string;
  createdAt: Date;
  viewed: boolean;
}
```

### Status Transitions

```
NEW ITEM
    ↓ (capture)
[status: pending]
    ↓ (classification starts)
[status: processing]
    ↓ (classification complete)
    ├── confidence >= 0.6 → [status: reviewed] + receipt
    └── confidence < 0.6  → [status: pending] (needs review)
```

### Needs Review Queue Query

```typescript
const needsReviewItems = await prisma.inboxItem.findMany({
  where: {
    userId,
    status: "pending",
    aiClassification: {
      path: ["confidence"],
      lt: threshold,
    },
  },
  orderBy: { createdAt: "desc" },
});
```

### Settings Schema Update

```typescript
interface UserSettings {
  confidenceThreshold: number; // default: 0.6
  autoArchiveDays: number;
  defaultModel: string;
  weeklyReviewDay: number;
}
```

## UI Components

### Receipt Toast Notification

```tsx
function ReceiptToast({ receipt }: { receipt: Receipt }) {
  return (
    <Toast>
      <div className="flex items-center gap-2">
        <CheckCircle className="h-5 w-5 text-green-500" />
        <div>
          <p className="font-medium">Auto-filed as {receipt.category}</p>
          <p className="text-sm text-gray-500">
            {Math.round(receipt.confidence * 100)}% confident
          </p>
        </div>
      </div>
      <Button variant="ghost" size="sm">
        View
      </Button>
    </Toast>
  );
}
```

### Needs Review Badge

```tsx
function NeedsReviewBadge() {
  const { data } = api.inbox.needsReviewCount.useQuery();

  if (!data?.count) return null;

  return (
    <Badge variant="destructive" className="ml-2">
      {data.count}
    </Badge>
  );
}
```

### Receipts Tab

```tsx
function ReceiptsTab() {
  const { data: receipts } = api.inbox.receipts.useQuery();

  return (
    <div className="space-y-2">
      {receipts?.map((receipt) => (
        <Card key={receipt.id}>
          <CardContent className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">{receipt.category}</p>
              <p className="text-sm text-gray-500">
                {receipt.reasoning}
              </p>
            </div>
            <Badge variant="outline">
              {Math.round(receipt.confidence * 100)}%
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

## tRPC Procedures

```typescript
export const inboxRouter = router({
  needsReviewCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await prisma.inboxItem.count({
      where: {
        userId: ctx.session.user.id,
        status: "pending",
        aiClassification: { not: null },
      },
    });
    return { count };
  }),

  receipts: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      return prisma.classificationAudit.findMany({
        where: {
          userId: ctx.session.user.id,
          reviewType: "auto",
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        include: { inboxItem: true },
      });
    }),

  updateConfidenceThreshold: protectedProcedure
    .input(z.object({ threshold: z.number().min(0).max(1) }))
    .mutation(async ({ ctx, input }) => {
      return prisma.user.update({
        where: { id: ctx.session.user.id },
        data: {
          settings: {
            ...ctx.session.user.settings,
            confidenceThreshold: input.threshold,
          },
        },
      });
    }),
});
```

## Dependencies

- Story 3.1 (AI Classification Service)
- User.settings field (from Story 1.2)
- ClassificationAudit model (from Story 1.2)

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/web/src/server/services/classification.service.ts` | Modify | Add routing logic |
| `apps/web/src/server/routers/inbox.ts` | Modify | Add needsReviewCount, receipts |
| `apps/web/src/components/inbox/needs-review-badge.tsx` | Create | Badge component |
| `apps/web/src/components/inbox/receipts-tab.tsx` | Create | Receipts list |
| `apps/web/src/components/settings/confidence-threshold.tsx` | Create | Threshold setting |

## Testing Checklist

- [ ] Confidence >= 0.6 → status "reviewed"
- [ ] Confidence < 0.6 → status "pending"
- [ ] Receipt notification shown for auto-filed items
- [ ] Needs Review count in navigation
- [ ] Receipts tab shows all auto-filed items
- [ ] Confidence threshold editable in settings
- [ ] Threshold change affects new items only

## Definition of Done

- [x] Routing logic implemented based on confidence
- [x] Receipt notifications for auto-filed items
- [x] Needs Review badge on navigation
- [x] Receipts tab accessible
- [x] Confidence threshold configurable
- [x] ClassificationAudit records routing decisions
- [x] TypeScript/ESLint pass

---

## Dev Agent Record

### Status
**Ready for Review**

### Agent Model Used
Claude Opus 4.5

### Tasks Completed
- [x] Update classification service to respect user's confidence threshold
- [x] Add reviewedAt timestamp and autoFiled flag for high-confidence items
- [x] Add needsReviewCount tRPC procedure
- [x] Add receipts tRPC procedure with pagination
- [x] Add getById tRPC procedure for item detail
- [x] Add getSettings, updateConfidenceThreshold, updateSettings to user router
- [x] Create NeedsReviewBadge component
- [x] Create ReceiptsTab component
- [x] Create ConfidenceThreshold settings component
- [x] Update tests for new routing logic (44 tests passing)

### File List
| File | Action | Status |
|------|--------|--------|
| `apps/web/src/server/services/classification.service.ts` | Modified | Complete |
| `apps/web/src/server/routers/inbox.ts` | Modified | Complete |
| `apps/web/src/server/routers/user.ts` | Modified | Complete |
| `apps/web/src/components/inbox/needs-review-badge.tsx` | Created | Complete |
| `apps/web/src/components/inbox/receipts-tab.tsx` | Created | Complete |
| `apps/web/src/components/settings/confidence-threshold.tsx` | Created | Complete |
| `apps/web/src/lib/trpc.ts` | Modified | Complete |
| `apps/web/src/server/services/__tests__/classification.service.test.ts` | Modified | Complete |

### Debug Log References
None - implementation completed without blocking issues.

### Completion Notes
- Classification service now reads user's confidenceThreshold from settings (default 0.6)
- High-confidence items set status to "reviewed", reviewedAt timestamp, and aiClassification.autoFiled flag
- Low-confidence items remain "pending" for manual review
- tRPC procedures added: inbox.needsReviewCount, inbox.receipts, inbox.getById
- User settings procedures: user.getSettings, user.updateConfidenceThreshold, user.updateSettings
- UI components created for badge, receipts list, and threshold slider
- Test coverage: 44 tests passing
- TypeScript and ESLint passing

---

## QA Results

**QA Status: PASSED**

| Verification | Result |
|--------------|--------|
| `pnpm typecheck` | All 3 packages pass |
| `pnpm lint` | No ESLint warnings or errors |
| classification.service.ts | Confidence routing logic implemented |
| inbox.ts router | needsReviewCount, receipts, getById procedures |
| user.ts router | getSettings, updateConfidenceThreshold, updateSettings |
| needs-review-badge.tsx | 26 lines, amber badge |
| receipts-tab.tsx | 90 lines, infinite scroll receipts list |
| confidence-threshold.tsx | 92 lines, Slider with save |

### Confidence Routing Logic Verified
- User's confidenceThreshold read from settings (line 89 in classification.service.ts)
- Default threshold: 0.6 (AUTO_REVIEW_CONFIDENCE_THRESHOLD constant)
- High confidence (>=threshold): status="reviewed", reviewedAt=new Date(), autoFiled=true
- Low confidence (<threshold): status="pending" for manual review
- aiClassification JSON includes autoFiled flag for tracking

### tRPC Procedures Verified

**inbox.needsReviewCount**
- Counts items where status="pending" AND aiClassification is not null
- Returns { count: number }

**inbox.receipts**
- Infinite scroll with cursor-based pagination
- Returns ClassificationAudit records where reviewType="auto"
- Includes related inboxItem (id, content, type, source, createdAt)
- Ordered by createdAt desc

**inbox.getById**
- Returns single InboxItem with latest audit record
- Validates userId ownership

**user.getSettings**
- Returns confidenceThreshold (default 0.6), autoArchiveDays (30), defaultModel ("claude"), weeklyReviewDay (0)

**user.updateConfidenceThreshold**
- Input: threshold (0-1)
- Merges with existing settings

**user.updateSettings**
- Accepts all settings fields as optional
- Merges with existing settings

### UI Components Verified

**NeedsReviewBadge**
- `trpc.inbox.needsReviewCount.useQuery()`
- Returns null when count is 0
- Shows "99+" for counts > 99
- Amber background with white text

**ReceiptsTab**
- `trpc.inbox.receipts.useInfiniteQuery({ limit: 20 })`
- Loading skeleton (3 animated placeholders)
- Empty state: "No receipts yet"
- Receipt card shows: category badge, confidence %, reasoning, content preview, timestamp
- "Load more" button when hasNextPage

**ConfidenceThreshold**
- `trpc.user.getSettings.useQuery()` for current value
- Local state for slider interaction
- Slider range: 0.1 to 0.95, step 0.05
- Save button appears when value changed
- Threshold descriptions: "Very strict", "Balanced", "Relaxed", "Very relaxed"

**QA Agent:** Claude Opus 4.5
**Date:** 2026-01-11

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-11 | 1.0 | Initial story specification | Bob (SM) |
