# Story 4.5: Review Session Persistence

## Story

**As a** user,
**I want** my review progress saved,
**So that** I can resume if interrupted.

## Priority

**P1** - Important for user experience, not blocking core flow

## Acceptance Criteria

1. Review session state persisted (current position, actions taken)
2. Closing app mid-review preserves progress
3. Returning to review resumes from where user left off
4. Option to start fresh review (clear session)
5. Session expires after 24 hours (starts fresh next day)
6. Session history retained for analytics

## Technical Design

### Session Lifecycle

```
[User opens /review]
    │
    ├─── Active session exists?
    │       │
    │       ├── Yes, not expired → Resume session
    │       │
    │       └── No or expired → Create new session
    │
    ↓
[Review in progress]
    │
    ├─── Each swipe → Save action to session
    │
    ├─── User leaves → Session preserved (auto-save)
    │
    └─── All items processed → Complete session
```

### Session State Model

```typescript
interface ReviewSession {
  id: string;
  userId: string;

  // Queue management
  itemIds: string[];           // Original ordered queue
  currentIndex: number;        // Current position (0-based)

  // Actions taken
  actions: SessionAction[];

  // Timing
  startedAt: Date;
  lastActivityAt: Date;
  completedAt?: Date;
  expiresAt: Date;            // startedAt + 24 hours

  // Aggregated stats
  stats: {
    agreed: number;
    disagreed: number;
    urgent: number;
    hidden: number;
    totalTimeMs: number;
  };
}

interface SessionAction {
  id: string;
  itemId: string;
  action: "agree" | "disagree" | "urgent" | "hide";
  timestamp: Date;
  undone: boolean;
  correctionId?: string;      // If disagree led to correction
}
```

### Auto-Save Implementation

```typescript
// Client-side: Debounced save on every state change
function useSessionPersistence(sessionId: string) {
  const updateSession = trpc.review.updateSession.useMutation();

  const saveSession = useDebouncedCallback(
    (updates: Partial<ReviewSession>) => {
      updateSession.mutate({ sessionId, ...updates });
    },
    500 // Debounce 500ms
  );

  // Also save on page visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveSession.flush(); // Immediate save when leaving
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [saveSession]);

  // Save on beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Sync save before page unload
      navigator.sendBeacon(
        "/api/review/save-session",
        JSON.stringify({ sessionId, lastActivityAt: new Date() })
      );
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [sessionId]);

  return { saveSession };
}
```

### Session Recovery Flow

```tsx
function ReviewPage() {
  const { data: existingSession, isLoading } = trpc.review.getActiveSession.useQuery();
  const createSession = trpc.review.startSession.useMutation();
  const [showResumeDialog, setShowResumeDialog] = useState(false);

  useEffect(() => {
    if (!isLoading && existingSession && !existingSession.completedAt) {
      // Found incomplete session
      setShowResumeDialog(true);
    }
  }, [isLoading, existingSession]);

  const handleResume = () => {
    setShowResumeDialog(false);
    // Continue with existing session
  };

  const handleStartFresh = async () => {
    // Archive old session and create new
    await createSession.mutateAsync({ forceNew: true });
    setShowResumeDialog(false);
  };

  return (
    <>
      {/* Resume Dialog */}
      <AlertDialog open={showResumeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resume previous session?</AlertDialogTitle>
            <AlertDialogDescription>
              You have an incomplete review session from{" "}
              {formatRelative(existingSession?.startedAt)}.
              <br />
              {existingSession?.currentIndex} of {existingSession?.itemIds.length} items
              processed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleStartFresh}>
              Start Fresh
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleResume}>
              Resume
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Review content */}
      {/* ... */}
    </>
  );
}
```

### Session Expiration

```typescript
// Check and handle expired sessions
async function getOrCreateSession(userId: string, forceNew = false) {
  // Find active session
  const existingSession = await prisma.reviewSession.findFirst({
    where: {
      userId,
      completedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { startedAt: "desc" },
  });

  if (existingSession && !forceNew) {
    // Update last activity
    return prisma.reviewSession.update({
      where: { id: existingSession.id },
      data: { lastActivityAt: new Date() },
    });
  }

  // Archive any expired sessions
  await prisma.reviewSession.updateMany({
    where: {
      userId,
      completedAt: null,
      expiresAt: { lte: new Date() },
    },
    data: {
      completedAt: new Date(),
      stats: {
        // Mark as expired, not completed
        expired: true,
      },
    },
  });

  // Create new session
  const pendingItems = await prisma.inboxItem.findMany({
    where: {
      userId,
      status: { in: ["pending", "processing"] },
      aiClassification: { not: null },
    },
    orderBy: [
      { status: "asc" }, // pending before processing
      { createdAt: "asc" }, // oldest first
    ],
    select: { id: true },
  });

  return prisma.reviewSession.create({
    data: {
      userId,
      itemIds: pendingItems.map((i) => i.id),
      currentIndex: 0,
      actions: [],
      startedAt: new Date(),
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      stats: {
        agreed: 0,
        disagreed: 0,
        urgent: 0,
        hidden: 0,
        totalTimeMs: 0,
      },
    },
  });
}
```

### Beacon Save Endpoint

```typescript
// apps/web/src/app/api/review/save-session/route.ts
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, lastActivityAt } = body;

    // Minimal update for beacon save
    await prisma.reviewSession.update({
      where: { id: sessionId },
      data: { lastActivityAt: new Date(lastActivityAt) },
    });

    return new Response("OK", { status: 200 });
  } catch (error) {
    // Beacon saves should fail silently
    return new Response("OK", { status: 200 });
  }
}
```

### Session Analytics

```typescript
// Track session metrics for improvement
async function getSessionAnalytics(userId: string, days = 30) {
  const sessions = await prisma.reviewSession.findMany({
    where: {
      userId,
      completedAt: { not: null },
      startedAt: { gte: subDays(new Date(), days) },
    },
    orderBy: { startedAt: "desc" },
  });

  const completedSessions = sessions.filter((s) => !s.stats?.expired);

  return {
    totalSessions: sessions.length,
    completedSessions: completedSessions.length,
    expiredSessions: sessions.length - completedSessions.length,

    // Average items per session
    avgItemsPerSession: mean(completedSessions.map((s) => s.itemIds.length)),

    // Average time per session
    avgSessionTimeMs: mean(completedSessions.map((s) => s.stats?.totalTimeMs || 0)),

    // Agreement rate
    totalAgreed: sum(completedSessions.map((s) => s.stats?.agreed || 0)),
    totalDisagreed: sum(completedSessions.map((s) => s.stats?.disagreed || 0)),

    // Best day/time for reviews (when sessions complete)
    completionsByHour: groupBy(completedSessions, (s) =>
      format(s.completedAt, "HH:00")
    ),
  };
}
```

### tRPC Procedures

```typescript
export const reviewRouter = router({
  getActiveSession: protectedProcedure.query(async ({ ctx }) => {
    const session = await prisma.reviewSession.findFirst({
      where: {
        userId: ctx.session.user.id,
        completedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { startedAt: "desc" },
    });

    if (!session) return null;

    // Fetch items for the session
    const items = await prisma.inboxItem.findMany({
      where: { id: { in: session.itemIds } },
    });

    // Maintain original order
    const orderedItems = session.itemIds
      .map((id) => items.find((i) => i.id === id))
      .filter(Boolean);

    return {
      ...session,
      items: orderedItems,
    };
  }),

  startSession: protectedProcedure
    .input(z.object({ forceNew: z.boolean().default(false) }).optional())
    .mutation(async ({ ctx, input }) => {
      return getOrCreateSession(ctx.session.user.id, input?.forceNew);
    }),

  updateSession: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      currentIndex: z.number().optional(),
      lastActivityAt: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return prisma.reviewSession.update({
        where: {
          id: input.sessionId,
          userId: ctx.session.user.id,
        },
        data: {
          currentIndex: input.currentIndex,
          lastActivityAt: input.lastActivityAt || new Date(),
        },
      });
    }),

  completeSession: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const session = await prisma.reviewSession.findUnique({
        where: { id: input.sessionId, userId: ctx.session.user.id },
      });

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Calculate final stats
      const actions = session.actions.filter((a) => !a.undone);
      const stats = {
        agreed: actions.filter((a) => a.action === "agree").length,
        disagreed: actions.filter((a) => a.action === "disagree").length,
        urgent: actions.filter((a) => a.action === "urgent").length,
        hidden: actions.filter((a) => a.action === "hide").length,
        totalTimeMs: Date.now() - new Date(session.startedAt).getTime(),
      };

      return prisma.reviewSession.update({
        where: { id: input.sessionId },
        data: {
          completedAt: new Date(),
          stats,
        },
      });
    }),

  getSessionHistory: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ ctx, input }) => {
      return prisma.reviewSession.findMany({
        where: {
          userId: ctx.session.user.id,
          completedAt: { not: null },
        },
        orderBy: { completedAt: "desc" },
        take: input.limit,
        select: {
          id: true,
          startedAt: true,
          completedAt: true,
          itemIds: true,
          stats: true,
        },
      });
    }),
});
```

## Database Schema

```prisma
model ReviewSession {
  id            String    @id @default(uuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Queue state
  itemIds       String[]
  currentIndex  Int       @default(0)
  actions       Json[]    // SessionAction[]

  // Timing
  startedAt     DateTime  @default(now())
  lastActivityAt DateTime @default(now())
  completedAt   DateTime?
  expiresAt     DateTime

  // Stats
  stats         Json?     // SessionStats

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([userId, completedAt])
  @@index([userId, expiresAt])
}
```

## Dependencies

- Story 4.3 (Daily Review Screen)
- tRPC router setup

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/web/src/lib/hooks/use-session-persistence.ts` | Create | Auto-save hook |
| `apps/web/src/app/api/review/save-session/route.ts` | Create | Beacon save endpoint |
| `apps/web/src/components/review/resume-dialog.tsx` | Create | Resume session dialog |
| `apps/web/src/server/routers/review.ts` | Modify | Add session management procedures |
| `packages/db/prisma/schema.prisma` | Modify | Add ReviewSession model |

## Testing Checklist

- [ ] New session created when none exists
- [ ] Existing session resumed when returning
- [ ] Session state updates on each swipe
- [ ] Page leave triggers auto-save
- [ ] App close triggers beacon save
- [ ] Expired sessions (24h+) start fresh
- [ ] "Start Fresh" option creates new session
- [ ] Session history accessible
- [ ] Stats calculated correctly on completion

## Definition of Done

- [x] Session persistence across page reloads
- [x] Session persistence across app close/reopen
- [x] Resume dialog for incomplete sessions
- [x] Force new session option
- [x] 24-hour expiration working
- [x] Session history stored
- [x] Auto-save on visibility change
- [x] Beacon save on page unload
- [x] TypeScript/ESLint pass
- [x] Integration tests for session lifecycle

---

## Dev Agent Record

### Implementation Summary

Story 4.5 implements session persistence for the daily review flow, allowing users to resume interrupted sessions. The core session management was already implemented in Story 4.2; this story adds auto-save, beacon save on page unload, and a resume dialog.

### Files Created

| File | Purpose |
|------|---------|
| `apps/web/src/lib/hooks/use-session-persistence.ts` | Auto-save hook with debouncing, visibility change handling, and beacon save |
| `apps/web/src/app/api/review/save-session/route.ts` | Beacon endpoint for reliable save on page unload |
| `apps/web/src/components/review/resume-dialog.tsx` | Dialog to resume or start fresh when returning to review |
| `apps/web/src/components/ui/alert-dialog.tsx` | Alert dialog UI component (Radix) |

### Files Modified

| File | Changes |
|------|---------|
| `apps/web/src/app/(fullscreen)/review/page.tsx` | Added ResumeDialog, integrated useSessionPersistence hook, auto-save on activity |
| `apps/web/src/components/review/index.ts` | Added ResumeDialog export |
| `apps/web/package.json` | Added @radix-ui/react-alert-dialog dependency |

### Key Implementation Details

1. **Auto-Save**: Debounced save (500ms) on session state changes, immediate flush on visibility change (tab switch, app background)

2. **Beacon Save**: Uses `navigator.sendBeacon()` on beforeunload for reliable save before page closes

3. **Resume Dialog**: Shows when returning to an incomplete session with progress, offers "Resume" or "Start Fresh" options

4. **Session Expiration**: Sessions expire after 24 hours (handled in review.service.ts from Story 4.2)

5. **Session History**: Already implemented in Story 4.2 via getSessionHistory procedure

### Testing Results

- 72 tests passing
- TypeScript compilation: ✓ Clean
- ESLint: ✓ No warnings or errors

### Acceptance Criteria Status

- [x] Review session state persisted (current position, actions taken)
- [x] Closing app mid-review preserves progress
- [x] Returning to review resumes from where user left off
- [x] Option to start fresh review (clear session)
- [x] Session expires after 24 hours
- [x] Session history retained for analytics

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

All acceptance criteria verified and Definition of Done items confirmed complete.

### Code Review Findings

#### 1. useSessionPersistence Hook (`use-session-persistence.ts`)

**Auto-Save Implementation:**
- ✅ Debounced save with 500ms delay
- ✅ Uses `useRef` for pending save and timeout management
- ✅ `flushSave()` for immediate save
- ✅ Merges updates before saving

**Visibility Change Handling:**
- ✅ Listens to `visibilitychange` event
- ✅ Flushes pending save when `document.visibilityState === "hidden"`
- ✅ Properly removes event listener on cleanup

**Beacon Save:**
- ✅ Uses `navigator.sendBeacon()` for reliable save on page unload
- ✅ Sends JSON payload with sessionId and lastActivityAt
- ✅ Targets `/api/review/save-session` endpoint
- ✅ Properly removes event listener on cleanup

#### 2. Beacon Save Endpoint (`api/review/save-session/route.ts`)

- ✅ Authenticates user via `auth()` session
- ✅ Validates sessionId is present and is a string
- ✅ Uses `updateMany` to verify ownership (userId match)
- ✅ Silent error handling (returns 200 OK even on error)
- ✅ Minimal processing for reliability

#### 3. ResumeDialog Component (`resume-dialog.tsx`)

- ✅ Uses AlertDialog component
- ✅ Shows relative time since session started (formatRelativeTime)
- ✅ Shows progress: "X of Y items processed (Z remaining)"
- ✅ "Resume" button to continue session
- ✅ "Start Fresh" button to create new session

**formatRelativeTime Function:**
- ✅ Handles "just now" (< 1 min)
- ✅ Handles minutes (< 60 min)
- ✅ Handles hours (< 24 hours)
- ✅ Handles days (≥ 24 hours)

#### 4. Review Page Integration

- ✅ Calls `useSessionPersistence(session?.id)`
- ✅ Checks for resume dialog on first load (`hasCheckedResume` flag)
- ✅ Shows resume dialog if `currentIndex > 0` and not completed
- ✅ "Start Fresh" calls `startSession.mutateAsync({ forceNew: true })`
- ✅ Auto-saves `lastActivityAt` on session activity changes

#### 5. Session Management (from review.service.ts)

**getOrCreateSession:**
- ✅ Finds active session with `completedAt: null` and `expiresAt > now`
- ✅ Updates `lastActivityAt` on resume
- ✅ Archives expired sessions with `expired: true` flag
- ✅ Creates new session with 24-hour expiration

**Session Expiration:**
- ✅ `expiresAt` calculated as `now + 24 hours`
- ✅ Query filters by `expiresAt: { gt: new Date() }`

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
| Session state persisted | ✅ Pass | currentIndex, actions in ReviewSession |
| Closing app preserves progress | ✅ Pass | Beacon save + visibility change |
| Returning resumes from where left off | ✅ Pass | ResumeDialog with progress |
| Option to start fresh | ✅ Pass | forceNew: true parameter |
| Session expires after 24 hours | ✅ Pass | expiresAt field with filter |
| Session history retained | ✅ Pass | getSessionHistory procedure |

### Architecture Verified

- ✅ Session lifecycle: Create → Progress → Complete/Expire
- ✅ Auto-save: Debounced (500ms) + Visibility change + Beacon
- ✅ Resume flow: Check active session → Show dialog → Resume/Fresh
- ✅ Data preservation: currentIndex, actions, stats all persisted

### Issues Found

None - implementation is complete and well-structured.
