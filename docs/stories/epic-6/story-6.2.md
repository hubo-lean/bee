# Story 6.2: Calendar Summary in Weekly Review

## Story

**As a** user,
**I want** to see a summary of my time commitments,
**So that** I can realistically plan my week.

## Priority

**P1** - Important for planning, not blocking core flow

## Acceptance Criteria

1. Weekly review includes calendar summary panel
2. Shows: total meeting hours, available focus hours, busiest day
3. Visual indicator if calendar is overloaded (>30 hours meetings)
4. Links to full calendar view for details
5. Summary refreshes on page load and when user triggers calendar sync

## Technical Design

### Calendar Summary Calculation

```typescript
interface CalendarSummary {
  weekStart: Date;
  weekEnd: Date;

  // Time metrics
  totalMeetingHours: number;
  totalFocusHours: number;      // 40 work hours - meeting hours
  meetingPercentage: number;    // % of work time in meetings

  // Daily breakdown
  dailyMeetingHours: {
    date: Date;
    hours: number;
    isOverloaded: boolean;      // > 6 hours
  }[];

  // Key stats
  busiestDay: {
    date: Date;
    hours: number;
  };
  lightestDay: {
    date: Date;
    hours: number;
  };

  // Event stats
  eventCount: number;
  averageMeetingDuration: number;
  longestMeeting: {
    title: string;
    duration: number;
  };

  // Warnings
  isOverloaded: boolean;        // > 30 hours meetings
  hasBackToBack: boolean;       // Any day with no breaks
}
```

### User Work Hours Settings

```typescript
// User settings interface (stored in user.settings JSON field)
interface UserSettings {
  calendar?: {
    workHoursPerDay: number;      // Default: 8
    workDaysPerWeek: number;      // Default: 5
    workStartHour: number;        // Default: 9 (9 AM)
    workEndHour: number;          // Default: 18 (6 PM)
    overloadedThreshold: number;  // Default: 30 hours/week
    dayOverloadedThreshold: number; // Default: 6 hours/day
  };
  // ... other settings
}

// Default values
const DEFAULT_WORK_SETTINGS = {
  workHoursPerDay: 8,
  workDaysPerWeek: 5,
  workStartHour: 9,
  workEndHour: 18,
  overloadedThreshold: 30,
  dayOverloadedThreshold: 6,
};

function getUserWorkSettings(user: User): typeof DEFAULT_WORK_SETTINGS {
  const settings = user.settings as UserSettings | null;
  return {
    ...DEFAULT_WORK_SETTINGS,
    ...settings?.calendar,
  };
}
```

### Summary Calculation Service

```typescript
async function calculateCalendarSummary(
  userId: string,
  weekStart: Date
): Promise<CalendarSummary> {
  // Get user's work hour settings
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  });
  const workSettings = getUserWorkSettings(user as User);

  const WORK_HOURS_PER_DAY = workSettings.workHoursPerDay;
  const WORK_DAYS_PER_WEEK = workSettings.workDaysPerWeek;
  const WORK_HOURS_PER_WEEK = WORK_HOURS_PER_DAY * WORK_DAYS_PER_WEEK;
  const OVERLOADED_THRESHOLD = workSettings.overloadedThreshold;
  const DAY_OVERLOADED_THRESHOLD = workSettings.dayOverloadedThreshold;
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  // Fetch events for the week
  const events = await prisma.calendarEvent.findMany({
    where: {
      userId,
      startTime: { gte: weekStart },
      endTime: { lte: weekEnd },
      status: "confirmed",
      isAllDay: false, // Exclude all-day events from time calc
    },
  });

  // Calculate total meeting hours
  const totalMinutes = events.reduce((sum, event) => {
    return sum + differenceInMinutes(
      new Date(event.endTime),
      new Date(event.startTime)
    );
  }, 0);
  const totalMeetingHours = totalMinutes / 60;

  // Calculate daily breakdown
  const workDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
    .filter((day) => !isWeekend(day));

  const dailyMeetingHours = workDays.map((day) => {
    const dayEvents = events.filter((e) =>
      isSameDay(new Date(e.startTime), day)
    );
    const minutes = dayEvents.reduce((sum, event) => {
      return sum + differenceInMinutes(
        new Date(event.endTime),
        new Date(event.startTime)
      );
    }, 0);
    const hours = minutes / 60;

    return {
      date: day,
      hours,
      isOverloaded: hours > DAY_OVERLOADED_THRESHOLD,
    };
  });

  // Find busiest and lightest days
  const sortedDays = [...dailyMeetingHours].sort((a, b) => b.hours - a.hours);
  const busiestDay = sortedDays[0];
  const lightestDay = sortedDays[sortedDays.length - 1];

  // Calculate average meeting duration
  const averageMeetingDuration = events.length > 0
    ? totalMinutes / events.length
    : 0;

  // Find longest meeting
  const longestMeeting = events.reduce(
    (longest, event) => {
      const duration = differenceInMinutes(
        new Date(event.endTime),
        new Date(event.startTime)
      );
      return duration > longest.duration
        ? { title: event.title, duration }
        : longest;
    },
    { title: "", duration: 0 }
  );

  // Check for back-to-back meetings (no 15+ minute breaks)
  const hasBackToBack = workDays.some((day) => {
    const dayEvents = events
      .filter((e) => isSameDay(new Date(e.startTime), day))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    for (let i = 0; i < dayEvents.length - 1; i++) {
      const gap = differenceInMinutes(
        new Date(dayEvents[i + 1].startTime),
        new Date(dayEvents[i].endTime)
      );
      if (gap < 15 && gap >= 0) {
        return true;
      }
    }
    return false;
  });

  return {
    weekStart,
    weekEnd,
    totalMeetingHours,
    totalFocusHours: Math.max(WORK_HOURS_PER_WEEK - totalMeetingHours, 0),
    meetingPercentage: (totalMeetingHours / WORK_HOURS_PER_WEEK) * 100,
    dailyMeetingHours,
    busiestDay: { date: busiestDay.date, hours: busiestDay.hours },
    lightestDay: { date: lightestDay.date, hours: lightestDay.hours },
    eventCount: events.length,
    averageMeetingDuration,
    longestMeeting,
    isOverloaded: totalMeetingHours > OVERLOADED_THRESHOLD,
    hasBackToBack,
  };
}
```

### Calendar Summary Component

```tsx
function CalendarSummaryCard({ weekStart }: { weekStart: Date }) {
  const { data: summary, isLoading } = trpc.calendar.getSummary.useQuery({
    weekStart,
  });

  if (isLoading) {
    return <CalendarSummarySkeleton />;
  }

  if (!summary) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <Calendar className="h-10 w-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-500">
            Connect your calendar to see your schedule
          </p>
          <Button variant="link" size="sm" asChild>
            <Link href="/settings/calendar">Connect</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      summary.isOverloaded && "border-orange-300 bg-orange-50"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            This Week's Calendar
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/calendar">View →</Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Overload Warning */}
        {summary.isOverloaded && (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Heavy meeting week! {summary.totalMeetingHours.toFixed(0)}+ hours of meetings
            </AlertDescription>
          </Alert>
        )}

        {/* Main Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {summary.totalMeetingHours.toFixed(1)}h
            </div>
            <div className="text-sm text-gray-500">Meetings</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {summary.totalFocusHours.toFixed(1)}h
            </div>
            <div className="text-sm text-gray-500">Focus Time</div>
          </div>
        </div>

        {/* Meeting Percentage Bar */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Time allocation</span>
            <span className="text-gray-500">
              {summary.meetingPercentage.toFixed(0)}% meetings
            </span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                summary.meetingPercentage > 75
                  ? "bg-red-500"
                  : summary.meetingPercentage > 50
                  ? "bg-orange-500"
                  : "bg-blue-500"
              )}
              style={{ width: `${Math.min(summary.meetingPercentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Daily Breakdown */}
        <div>
          <p className="text-sm font-medium mb-2">Daily breakdown</p>
          <div className="flex gap-1">
            {summary.dailyMeetingHours.map((day) => (
              <div
                key={day.date.toISOString()}
                className="flex-1 flex flex-col items-center"
              >
                <div
                  className={cn(
                    "w-full rounded-t",
                    day.isOverloaded ? "bg-orange-400" : "bg-blue-400"
                  )}
                  style={{ height: `${Math.max(day.hours * 8, 4)}px` }}
                />
                <span className="text-xs text-gray-500 mt-1">
                  {format(day.date, "EEE")}
                </span>
                <span className="text-xs font-medium">
                  {day.hours.toFixed(1)}h
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Key Insights */}
        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">Busiest day</span>
            <span className="font-medium">
              {format(summary.busiestDay.date, "EEEE")} ({summary.busiestDay.hours.toFixed(1)}h)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Best focus day</span>
            <span className="font-medium">
              {format(summary.lightestDay.date, "EEEE")} ({summary.lightestDay.hours.toFixed(1)}h)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total meetings</span>
            <span className="font-medium">{summary.eventCount}</span>
          </div>
          {summary.hasBackToBack && (
            <div className="flex items-center gap-1 text-orange-600">
              <AlertCircle className="h-4 w-4" />
              <span>Back-to-back meetings detected</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

### Integration with Weekly Review

```tsx
// In weekly review wizard, add to priorities step sidebar
function PrioritiesStep({ session, onComplete, onBack }) {
  const weekStart = startOfWeek(session.weekStart, { weekStartsOn: 1 });

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1">
        {/* ... existing priorities content ... */}
      </div>

      {/* Sidebar with calendar summary */}
      <div className="w-80 shrink-0">
        <CalendarSummaryCard weekStart={weekStart} />
      </div>
    </div>
  );
}
```

### Mini Summary for Dashboard

```tsx
function CalendarMiniSummary() {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const { data: summary } = trpc.calendar.getSummary.useQuery({ weekStart });

  if (!summary) return null;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-full",
              summary.isOverloaded ? "bg-orange-100" : "bg-blue-100"
            )}>
              <Calendar className={cn(
                "h-5 w-5",
                summary.isOverloaded ? "text-orange-600" : "text-blue-600"
              )} />
            </div>
            <div>
              <p className="font-medium">
                {summary.totalMeetingHours.toFixed(0)}h meetings this week
              </p>
              <p className="text-sm text-gray-500">
                {summary.totalFocusHours.toFixed(0)}h focus time available
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/calendar">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### tRPC Procedure

```typescript
export const calendarRouter = router({
  // ... existing procedures ...

  getSummary: protectedProcedure
    .input(z.object({
      weekStart: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      // Check if user has calendar connected
      const account = await prisma.calendarAccount.findFirst({
        where: { userId: ctx.session.user.id, isDefault: true },
      });

      if (!account) {
        return null;
      }

      return calculateCalendarSummary(ctx.session.user.id, input.weekStart);
    }),
});
```

## Dependencies

- Story 6.1 (Calendar Integration) - Required for calendar event data
- Story 5.2 (Weekly Review Wizard) - **VERIFIED**: docs/stories/epic-5/story-5.2.md exists
- date-fns (date calculations)

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/web/src/server/services/calendar.service.ts` | Modify | Add getSummary method |
| `apps/web/src/server/routers/calendar.ts` | Modify | Add getSummary procedure |
| `apps/web/src/components/calendar/calendar-summary.tsx` | Create | Full summary card |
| `apps/web/src/components/calendar/calendar-mini-summary.tsx` | Create | Dashboard widget |
| `apps/web/src/components/review/weekly/priorities-step.tsx` | Modify | Add sidebar with summary |

## Testing Checklist

- [ ] Summary calculates correct meeting hours
- [ ] Focus hours = work hours - meeting hours (configurable)
- [ ] Daily breakdown shows correct hours per day
- [ ] Busiest day identified correctly
- [ ] Overload warning shows at threshold (configurable)
- [ ] Back-to-back detection works
- [ ] No calendar shows connect prompt
- [ ] Links to full calendar work
- [ ] Summary refreshes on page load
- [ ] Summary refreshes after calendar sync
- [ ] User work hours settings respected in calculations

## Definition of Done

- [ ] Calendar summary card component
- [ ] Total meeting hours calculation
- [ ] Available focus hours calculation
- [ ] Daily breakdown visualization
- [ ] Overload warning indicator
- [ ] Back-to-back meeting detection
- [ ] Integration with weekly review
- [ ] Dashboard mini widget
- [ ] TypeScript/ESLint pass
- [ ] Unit tests for calculations

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-11 | 1.0 | Initial story specification | Bob (SM) |
