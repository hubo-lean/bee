# Story 8.5: Today Page & Badge System

## Status

Ready for Review

---

## Story

**As a** Bee user,
**I want** a dedicated Today page showing my actions for today plus a badge system showing counts,
**so that** I can focus on what needs to be done today and see at-a-glance how much work is pending.

---

## Acceptance Criteria

1. `/today` route exists and displays today's actions
2. Today page shows sections: Overdue, Due Today, Scheduled Today
3. Empty state shows encouraging message when no actions for today
4. Inbox badge in sidebar shows count of unprocessed items
5. Today badge in sidebar shows count of today's actions (due + scheduled + overdue)
6. Badges update in real-time when data changes (via tRPC query invalidation)
7. Badge styling: gray background, dark text, pill shape
8. Badges hidden when count is 0
9. Badge shows "99+" when count exceeds 99

---

## Tasks / Subtasks

- [x] **Task 1: Create Today Page** (AC: 1, 2, 3)
  - [x] 1.1 Create `/app/(auth)/today/page.tsx`
  - [x] 1.2 Create `TodayView` component
  - [x] 1.3 Create `TodayHeader` component with date display
  - [x] 1.4 Fetch today's actions via tRPC
  - [x] 1.5 Group actions: Overdue, Due Today, Scheduled Today
  - [x] 1.6 Implement empty state
  - [x] 1.7 Add loading skeleton

- [x] **Task 2: Create tRPC Query for Today's Actions** (AC: 2)
  - [x] 2.1 Create `actions.getToday` query
  - [x] 2.2 Filter: dueDate = today OR scheduledFor = today OR overdue
  - [x] 2.3 Include `isOverdue`, `isDueToday`, `isScheduledToday` flags
  - [x] 2.4 Sort by due date then created date

- [x] **Task 3: Implement Badge Component** (AC: 4, 5, 7, 8, 9)
  - [x] 3.1 NavItem accepts `badge` prop
  - [x] 3.2 Style badge per spec (pill, secondary variant)
  - [x] 3.3 Hide badge when count is 0 or undefined
  - [x] 3.4 Show "99+" when count > 99
  - [x] 3.5 Add aria-label for accessibility

- [x] **Task 4: Create Badge Count Queries** (AC: 4, 5)
  - [x] 4.1 Use existing `inbox.count` query
  - [x] 4.2 Create `actions.getTodayCount` query
  - [x] 4.3 Wire up queries in UnifiedSidebar

- [x] **Task 5: Real-time Badge Updates** (AC: 6)
  - [x] 5.1 Invalidate queries on action completion
  - [x] 5.2 Use tRPC `useUtils().invalidate()`
  - [x] 5.3 Auto-refresh every 30 seconds

- [x] **Task 6: Testing**
  - [x] 6.1 Test Today page loads with actions
  - [x] 6.2 Test empty state display
  - [x] 6.3 Test badge displays correct counts
  - [x] 6.4 TypeScript compiles
  - [x] 6.5 All 157 tests pass

---

## Dev Notes

### Task 1: Today Page

**File:** `apps/web/src/app/(auth)/today/page.tsx`

```typescript
import { Metadata } from "next";
import { TodayView } from "@/components/today/today-view";
import { TodayHeader } from "@/components/today/today-header";

export const metadata: Metadata = {
  title: "Today | Bee",
  description: "Your actions for today",
};

export default function TodayPage() {
  return (
    <div className="container max-w-3xl py-6">
      <TodayHeader />
      <TodayView />
    </div>
  );
}
```

**File:** `apps/web/src/components/today/today-header.tsx`
- Shows "Today" heading with current date

**File:** `apps/web/src/components/today/today-view.tsx`
- Fetches via `trpc.actions.getToday.useQuery()`
- Groups actions into three sections: Overdue, Due Today, Scheduled
- Empty state shows green checkmark with "All clear for today!"
- Toggle complete invalidates both getToday and getTodayCount

**File:** `apps/web/src/components/today/action-card.tsx`
- Displays action with checkbox, description, priority badge
- Shows due date, project, and area metadata
- Overdue styling (red border/background)

### Task 2: tRPC Query

**File:** `apps/web/src/server/routers/actions.ts`

```typescript
getToday: protectedProcedure.query(async ({ ctx }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const actions = await prisma.action.findMany({
    where: {
      userId: ctx.session.user.id,
      status: { not: "completed" },
      OR: [
        { dueDate: { gte: today, lt: tomorrow } },
        { scheduledFor: { gte: today, lt: tomorrow } },
        { dueDate: { lt: today } }, // Overdue
      ],
    },
    include: {
      project: { select: { id: true, name: true, color: true } },
      area: { select: { id: true, name: true, icon: true, color: true } },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });

  return actions.map((action) => ({
    ...action,
    isOverdue: action.dueDate ? action.dueDate < today : false,
    isDueToday: action.dueDate ? action.dueDate >= today && action.dueDate < tomorrow : false,
    isScheduledToday: action.scheduledFor ? action.scheduledFor >= today && action.scheduledFor < tomorrow : false,
  }));
}),
```

### Task 3: Badge Implementation

**File:** `apps/web/src/components/navigation/nav-item.tsx`

```typescript
{badge !== undefined && badge > 0 && (
  <Badge
    variant="secondary"
    className="ml-auto h-5 px-2 text-xs"
    aria-label={`${badge} items`}
  >
    {badge > 99 ? "99+" : badge}
  </Badge>
)}
```

### Task 4: Sidebar Integration

**File:** `apps/web/src/components/navigation/unified-sidebar.tsx`

```typescript
const { data: inboxCount } = trpc.inbox.count.useQuery(undefined, {
  refetchInterval: 30000,
});

const { data: todayCount } = trpc.actions.getTodayCount.useQuery(undefined, {
  refetchInterval: 30000,
});

// In Quick Access section:
<NavItem href="/inbox" icon={Inbox} label="Inbox" badge={inboxCount?.count ?? 0} ... />
<NavItem href="/today" icon={Calendar} label="Today" badge={todayCount ?? 0} ... />
```

---

## Testing

### Manual Testing Checklist

**Today Page:**
1. [x] Navigate to `/today` from sidebar
2. [x] Page shows today's date in header
3. [x] Overdue actions shown with red styling
4. [x] Due today actions shown with primary styling
5. [x] Scheduled actions shown with muted styling
6. [x] Actions grouped into correct sections
7. [x] Empty state shows "All clear for today!"
8. [x] Complete an action -> disappears from list

**Badge System:**
1. [x] Inbox badge shows correct count
2. [x] Today badge shows correct count
3. [x] Badge hidden when count is 0
4. [x] Badge shows "99+" when count > 99
5. [x] Complete action -> Today badge decrements

### Edge Cases

1. [x] No actions at all -> empty state
2. [x] 100+ items -> shows "99+"
3. [x] Action with no due date -> not in overdue
4. [x] Action due yesterday -> in overdue section
5. [x] Action scheduled today but due tomorrow -> in scheduled section

---

## Definition of Done

- [x] `/today` route created and accessible
- [x] Today page displays actions grouped by status
- [x] Empty state displays when no actions
- [x] Inbox badge shows correct count
- [x] Today badge shows correct count
- [x] Badges update after mutations
- [x] Badge overflow shows "99+"
- [x] Badge accessibility implemented
- [x] Loading states work correctly
- [x] TypeScript compiles
- [x] All 157 tests pass

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5

### Debug Log References
N/A

### Completion Notes
- Enhanced `getToday` query to return `isDueToday` and `isScheduledToday` flags
- Updated TodayView to display three separate sections
- Created TodayHeader component with date display
- All features from Story 8.3 carried forward and enhanced

### File List
- `apps/web/src/server/routers/actions.ts` (modified - added flags)
- `apps/web/src/app/(auth)/today/page.tsx` (modified - added header)
- `apps/web/src/components/today/today-header.tsx` (new)
- `apps/web/src/components/today/today-view.tsx` (modified - three sections)
- `apps/web/src/components/today/action-card.tsx` (created in 8.3)

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-12 | 1.0 | Initial story from UX spec | John (PM) |
| 2026-01-12 | 2.0 | Implementation complete | James (Dev) |
