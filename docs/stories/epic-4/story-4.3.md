# Story 4.3: Daily Review Screen

## Story

**As a** user,
**I want** a dedicated daily review experience,
**So that** I can process my inbox efficiently each day.

## Priority

**P0** - Core user experience for daily habits

## Acceptance Criteria

1. Daily review screen shows card stack of pending items
2. Progress indicator shows items remaining (e.g., "5 of 12")
3. Session summary shown when complete ("12 items processed in 3:24")
4. Quick stats: items agreed, disagreed, urgent, hidden
5. Celebration/completion animation when inbox reaches zero
6. Screen optimized for one-handed mobile use

## Technical Design

### Screen Layout (Mobile-First)

```
┌─────────────────────────────────┐
│  ←  Daily Review    5 of 12    │  ← Header with back + progress
├─────────────────────────────────┤
│                                 │
│    ┌───────────────────────┐   │
│    │                       │   │
│    │                       │   │
│    │     [SWIPE CARD]      │   │  ← Card stack (stacked behind)
│    │                       │   │
│    │                       │   │
│    └───────────────────────┘   │
│                                 │
├─────────────────────────────────┤
│  ↑         ← →         ↓       │  ← Gesture hints
│ Urgent   Disagree Agree  Hide   │
└─────────────────────────────────┘
```

### Card Stack Component

```tsx
function CardStack({
  items,
  currentIndex,
  onSwipe,
}: {
  items: InboxItem[];
  currentIndex: number;
  onSwipe: (direction: SwipeDirection, itemId: string) => void;
}) {
  // Show current card + 2 behind for stack effect
  const visibleCards = items.slice(currentIndex, currentIndex + 3);

  return (
    <div className="relative h-full">
      {visibleCards.map((item, stackIndex) => (
        <SwipeCard
          key={item.id}
          item={item}
          isActive={stackIndex === 0}
          stackIndex={stackIndex}
          onSwipe={(dir) => onSwipe(dir, item.id)}
          style={{
            zIndex: 3 - stackIndex,
            transform: `scale(${1 - stackIndex * 0.05}) translateY(${stackIndex * 8}px)`,
            opacity: 1 - stackIndex * 0.15,
          }}
        />
      ))}
    </div>
  );
}
```

### Progress Indicator

```tsx
function ProgressIndicator({
  current,
  total,
  stats,
}: {
  current: number;
  total: number;
  stats: SessionStats;
}) {
  const progress = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-blue-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Counter */}
      <div className="flex justify-between text-sm text-gray-600">
        <span>{current} of {total}</span>
        <span>{total - current} remaining</span>
      </div>

      {/* Mini stats */}
      <div className="flex gap-4 text-xs">
        <span className="text-green-600">✓ {stats.agreed}</span>
        <span className="text-red-600">✗ {stats.disagreed}</span>
        <span className="text-orange-600">! {stats.urgent}</span>
        <span className="text-gray-600">⌫ {stats.hidden}</span>
      </div>
    </div>
  );
}
```

### Gesture Hints

```tsx
function GestureHints({ showHints }: { showHints: boolean }) {
  if (!showHints) return null;

  return (
    <div className="grid grid-cols-4 gap-2 text-center text-xs text-gray-500 py-4">
      <div className="flex flex-col items-center">
        <ArrowUp className="h-5 w-5 text-orange-500" />
        <span>Urgent</span>
      </div>
      <div className="flex flex-col items-center">
        <ArrowLeft className="h-5 w-5 text-red-500" />
        <span>Disagree</span>
      </div>
      <div className="flex flex-col items-center">
        <ArrowRight className="h-5 w-5 text-green-500" />
        <span>Agree</span>
      </div>
      <div className="flex flex-col items-center">
        <ArrowDown className="h-5 w-5 text-gray-500" />
        <span>Hide</span>
      </div>
    </div>
  );
}
```

### Session Complete Screen

```tsx
function SessionComplete({
  stats,
  duration,
  onDone,
  onViewReceipts,
}: {
  stats: SessionStats;
  duration: number;
  onDone: () => void;
  onViewReceipts: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center h-full text-center px-8"
    >
      {/* Celebration animation */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", delay: 0.2 }}
      >
        <PartyPopper className="h-24 w-24 text-yellow-500 mb-6" />
      </motion.div>

      <h1 className="text-2xl font-bold mb-2">Inbox Zero!</h1>
      <p className="text-gray-600 mb-8">
        {stats.total} items processed in {formatDuration(duration)}
      </p>

      {/* Stats breakdown */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-8">
        <StatCard icon={CheckCircle} value={stats.agreed} label="Agreed" color="green" />
        <StatCard icon={XCircle} value={stats.disagreed} label="Disagreed" color="red" />
        <StatCard icon={AlertTriangle} value={stats.urgent} label="Urgent" color="orange" />
        <StatCard icon={Archive} value={stats.hidden} label="Archived" color="gray" />
      </div>

      {/* Actions */}
      <div className="space-y-3 w-full max-w-xs">
        <Button onClick={onDone} className="w-full">
          Done
        </Button>
        <Button onClick={onViewReceipts} variant="outline" className="w-full">
          View Receipts
        </Button>
      </div>
    </motion.div>
  );
}

function StatCard({ icon: Icon, value, label, color }) {
  const colors = {
    green: "bg-green-100 text-green-600",
    red: "bg-red-100 text-red-600",
    orange: "bg-orange-100 text-orange-600",
    gray: "bg-gray-100 text-gray-600",
  };

  return (
    <div className={`p-4 rounded-lg ${colors[color]}`}>
      <Icon className="h-6 w-6 mb-1" />
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm">{label}</div>
    </div>
  );
}
```

### Empty State (No Items to Review)

```tsx
function EmptyInbox() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <Inbox className="h-16 w-16 text-gray-300 mb-4" />
      <h2 className="text-xl font-medium text-gray-700 mb-2">
        All caught up!
      </h2>
      <p className="text-gray-500 mb-6">
        Your inbox is empty. Great job staying on top of things.
      </p>
      <Button variant="outline" asChild>
        <Link href="/capture">Capture something new</Link>
      </Button>
    </div>
  );
}
```

### Main Review Page

```tsx
// apps/web/src/app/(app)/review/page.tsx
export default function DailyReviewPage() {
  const { data: session, isLoading: sessionLoading } = trpc.review.getActiveSession.useQuery();
  const startSession = trpc.review.startSession.useMutation();
  const recordSwipe = trpc.review.recordSwipe.useMutation();

  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionItem, setCorrectionItem] = useState<InboxItem | null>(null);
  const [undoAction, setUndoAction] = useState<SwipeAction | null>(null);

  // Start session if none exists
  useEffect(() => {
    if (!sessionLoading && !session) {
      startSession.mutate();
    }
  }, [sessionLoading, session]);

  const handleSwipe = async (direction: SwipeDirection, itemId: string) => {
    const result = await recordSwipe.mutateAsync({
      sessionId: session.id,
      itemId,
      direction,
    });

    if (result.openModal === "correction") {
      const item = session.items.find((i) => i.id === itemId);
      setCorrectionItem(item);
      setShowCorrectionModal(true);
    } else {
      // Show undo toast
      setUndoAction({
        direction,
        itemId,
        timestamp: new Date(),
        previousState: result.previousState,
      });
    }
  };

  if (sessionLoading) {
    return <ReviewSkeleton />;
  }

  if (!session?.items.length) {
    return <EmptyInbox />;
  }

  if (session.currentIndex >= session.items.length) {
    return (
      <SessionComplete
        stats={session.stats}
        duration={Date.now() - new Date(session.startedAt).getTime()}
        onDone={() => router.push("/dashboard")}
        onViewReceipts={() => router.push("/inbox?tab=receipts")}
      />
    );
  }

  return (
    <div className="flex flex-col h-[100dvh]">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="font-semibold">Daily Review</h1>
        <span className="text-sm text-gray-500">
          {session.currentIndex + 1} of {session.items.length}
        </span>
      </header>

      {/* Progress */}
      <div className="px-4 py-2">
        <ProgressIndicator
          current={session.currentIndex}
          total={session.items.length}
          stats={session.stats}
        />
      </div>

      {/* Card Stack */}
      <div className="flex-1 px-4 py-6">
        <CardStack
          items={session.items}
          currentIndex={session.currentIndex}
          onSwipe={handleSwipe}
        />
      </div>

      {/* Gesture Hints */}
      <GestureHints showHints={session.currentIndex < 3} />

      {/* Undo Toast */}
      {undoAction && (
        <UndoToast
          action={undoAction}
          onUndo={() => {
            // Handle undo
            setUndoAction(null);
          }}
          onExpire={() => setUndoAction(null)}
        />
      )}

      {/* Correction Modal */}
      <CorrectionModal
        open={showCorrectionModal}
        item={correctionItem}
        onClose={() => setShowCorrectionModal(false)}
      />
    </div>
  );
}
```

### Duration Formatting

```typescript
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
```

### One-Handed Optimization

```css
/* Safe area for mobile devices */
.review-screen {
  padding-bottom: env(safe-area-inset-bottom);
  padding-top: env(safe-area-inset-top);
}

/* Touch target sizing */
.swipe-card {
  min-height: 60vh;
  touch-action: pan-y;
}

/* Reachable zone for thumb */
.action-buttons {
  position: fixed;
  bottom: calc(env(safe-area-inset-bottom) + 16px);
}
```

## Dependencies

- Story 4.1 (Swipe Card Component)
- Story 4.2 (Swipe Gesture Actions)
- framer-motion (animations)

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/web/src/app/(app)/review/page.tsx` | Create | Main review page |
| `apps/web/src/components/review/card-stack.tsx` | Create | Card stack manager |
| `apps/web/src/components/review/progress-indicator.tsx` | Create | Progress display |
| `apps/web/src/components/review/gesture-hints.tsx` | Create | Gesture guidance |
| `apps/web/src/components/review/session-complete.tsx` | Create | Completion celebration |
| `apps/web/src/components/review/empty-inbox.tsx` | Create | Empty state |
| `apps/web/src/components/review/review-skeleton.tsx` | Create | Loading skeleton |

## Testing Checklist

- [ ] Card stack displays correctly with stacked effect
- [ ] Progress updates after each swipe
- [ ] Stats update in real-time
- [ ] Completion screen shows when all items processed
- [ ] Celebration animation plays on completion
- [ ] Empty state displays when no items
- [ ] Gesture hints show for first few cards
- [ ] Screen works in portrait and landscape
- [ ] Safe areas respected on iOS/Android
- [ ] Touch targets are thumb-reachable

## Definition of Done

- [x] Full-screen review experience implemented
- [x] Card stack with stacked visual effect
- [x] Progress indicator shows current/total
- [x] Session stats displayed (agreed/disagreed/urgent/hidden)
- [x] Completion celebration with confetti
- [x] Empty inbox state
- [x] Mobile-optimized layout
- [x] Gesture hints for new users
- [x] TypeScript/ESLint pass
- [ ] Tested on iOS Safari and Android Chrome

---

## Dev Agent Record

### Implementation Summary

Story 4.3 implements the full-screen daily review experience with a card stack, progress tracking, gesture hints, and completion celebration.

### Files Created

| File | Purpose |
|------|---------|
| `apps/web/src/app/(fullscreen)/layout.tsx` | Full-screen layout without sidebar/bottom nav for immersive experiences |
| `apps/web/src/app/(fullscreen)/review/page.tsx` | Main review page with card stack, progress, undo, and completion handling |
| `apps/web/src/components/review/card-stack.tsx` | Card stack manager showing top 3 cards with stacked effect |
| `apps/web/src/components/review/progress-indicator.tsx` | Progress bar with current/total counter and mini stats |
| `apps/web/src/components/review/gesture-hints.tsx` | Visual hints for swipe directions (shown for first 3 cards) |
| `apps/web/src/components/review/session-complete.tsx` | Completion celebration with stats breakdown and animated party popper |
| `apps/web/src/components/review/empty-inbox.tsx` | Empty state when no items to review |
| `apps/web/src/components/review/review-skeleton.tsx` | Loading skeleton for review page |

### Files Modified

| File | Changes |
|------|---------|
| `apps/web/src/components/review/index.ts` | Added exports for CardStack, ProgressIndicator, GestureHints, SessionComplete, EmptyInbox, ReviewSkeleton |
| `apps/web/src/components/review/undo-toast.tsx` | Changed action type from SwipeDirection to ActionType (agree/disagree/urgent/hide) |

### Key Implementation Details

1. **Route Group**: Created `(fullscreen)` route group for immersive experiences without navigation elements

2. **Card Stack**: Shows top 3 cards with visual stacking effect (scale and Y offset)

3. **Progress Tracking**:
   - Progress bar with animated fill
   - Current/remaining counter
   - Mini stats showing agreed/disagreed/urgent/hidden counts

4. **Session Flow**:
   - Auto-starts session if none exists
   - Tracks currentIndex for progress
   - Shows completion screen when all items processed
   - Integrates with undo functionality from Story 4.2

5. **Mobile Optimization**:
   - Uses `100dvh` for proper mobile viewport handling
   - Safe area padding for iOS/Android
   - Touch-optimized gesture hints

### Testing Results

- 72 tests passing
- TypeScript compilation: ✓ Clean
- ESLint: ✓ No warnings or errors

### Acceptance Criteria Status

- [x] Daily review screen shows card stack of pending items
- [x] Progress indicator shows items remaining
- [x] Session summary shown when complete
- [x] Quick stats: items agreed, disagreed, urgent, hidden
- [x] Celebration animation when inbox reaches zero
- [x] Screen optimized for one-handed mobile use

### Status: Ready for Review

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-11 | 1.0 | Initial story specification | Bob (SM) |
| 2026-01-11 | 1.1 | Implementation complete | James (Dev) |
| 2026-01-11 | 1.2 | QA Review complete | QA |

---

## QA Results

### Verification Summary

**QA Status: PASSED**

All acceptance criteria verified. One item pending manual testing on mobile devices.

### Code Review Findings

#### 1. Review Page (`(fullscreen)/review/page.tsx`)
- ✅ Full-screen layout using `(fullscreen)` route group
- ✅ Uses `100dvh` for proper mobile viewport handling
- ✅ Integrates with tRPC for session management
- ✅ Handles loading, empty, and completion states
- ✅ Shows gesture hints for first 3 cards
- ✅ Integrates CorrectionModal, UndoToast, ResumeDialog
- ✅ Safe area padding with `env(safe-area-inset-bottom)`
- ✅ Auto-starts session if none exists

#### 2. CardStack Component (`card-stack.tsx`)
- ✅ Shows top 3 cards with stacked visual effect
- ✅ Z-index layering (3, 2, 1) for proper stacking
- ✅ `transformItem()` function handles Prisma JSON type conversions
- ✅ Only active (top) card responds to gestures

#### 3. ProgressIndicator Component (`progress-indicator.tsx`)
- ✅ Animated progress bar with framer-motion
- ✅ Current/remaining counter
- ✅ Mini stats icons: Check (agreed), X (disagreed), AlertTriangle (urgent), Archive (hidden)
- ✅ Dark mode support

#### 4. SessionComplete Component (`session-complete.tsx`)
- ✅ Celebration animation with PartyPopper icon (rotate + scale)
- ✅ "Inbox Zero!" message
- ✅ Stats breakdown in 2x2 grid with StatCard components
- ✅ Duration formatting (Xs or M:SS format)
- ✅ "Done" and "View Receipts" buttons
- ✅ Staggered entry animations

#### 5. Supporting Components
- ✅ `GestureHints`: Direction icons with labels (shown for first 3 cards)
- ✅ `EmptyInbox`: "All caught up!" message with link to capture
- ✅ `ReviewSkeleton`: Loading skeleton

### Build Verification

```
$ pnpm typecheck
✓ All packages passed type checking

$ pnpm lint
✓ No ESLint warnings or errors
```

### Items Verified

| Acceptance Criteria | Status | Notes |
|---------------------|--------|-------|
| Daily review screen shows card stack | ✅ Pass | CardStack with 3 visible cards |
| Progress indicator shows items remaining | ✅ Pass | "X of Y" with animated bar |
| Session summary shown when complete | ✅ Pass | SessionComplete with stats |
| Quick stats: agreed/disagreed/urgent/hidden | ✅ Pass | Mini stats in ProgressIndicator |
| Celebration animation on completion | ✅ Pass | PartyPopper with spring animation |
| Screen optimized for one-handed mobile use | ✅ Pass | 100dvh, safe areas, touch-action |

### Pending Items

| Item | Status | Notes |
|------|--------|-------|
| iOS Safari testing | ⏳ Pending | Manual device testing required |
| Android Chrome testing | ⏳ Pending | Manual device testing required |
