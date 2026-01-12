# Story 6.3: Time Block Creation

## Story

**As a** user,
**I want** to schedule time blocks for my actions directly from Bee,
**So that** I can protect time for important work.

## Priority

**P1** - Enhances productivity workflow, builds on calendar read

## Acceptance Criteria

1. User can create a time block from any action item
2. Time block picker shows available slots from calendar
3. Default duration options: 30min, 1h, 2h, custom
4. Time blocks sync to connected calendar
5. Action links back to the created calendar event
6. Conflict detection warns about overlapping events

## Technical Design

### Time Block Creation Flow

```
[Action Item] → "Schedule Time" button
    ↓
[Time Block Modal]
    ├── Date picker (default: today or next available)
    ├── Time slot suggestions (based on free time)
    ├── Duration selector
    └── Notes field (optional)
    ↓
[Create CalendarEvent via provider API]
    ↓
[Link event to Action item]
```

### Time Block Modal Component

```tsx
interface TimeBlockModalProps {
  action: Action;
  open: boolean;
  onClose: () => void;
  onCreated: (eventId: string) => void;
}

function TimeBlockModal({ action, open, onClose, onCreated }: TimeBlockModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(60); // minutes
  const [notes, setNotes] = useState("");

  const { data: freeSlots, isLoading: loadingSlots } = trpc.calendar.getFreeSlots.useQuery({
    date: selectedDate,
    minDuration: duration,
  });

  const createTimeBlock = trpc.calendar.createTimeBlock.useMutation({
    onSuccess: (result) => {
      onCreated(result.eventId);
      onClose();
    },
  });

  const handleCreate = () => {
    if (!selectedTime) return;

    const [hours, minutes] = selectedTime.split(":").map(Number);
    const startTime = new Date(selectedDate);
    startTime.setHours(hours, minutes, 0, 0);

    createTimeBlock.mutate({
      actionId: action.id,
      startTime,
      duration,
      notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Time Block</DialogTitle>
          <DialogDescription>
            Block time for: {action.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date Picker */}
          <div>
            <Label>Date</Label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              disabled={(date) => date < startOfDay(new Date())}
              className="rounded-md border"
            />
          </div>

          {/* Duration Selector */}
          <div>
            <Label>Duration</Label>
            <div className="flex gap-2 mt-2">
              {[30, 60, 120].map((mins) => (
                <Button
                  key={mins}
                  variant={duration === mins ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDuration(mins)}
                >
                  {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                </Button>
              ))}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    Custom
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48">
                  <div className="space-y-2">
                    <Label>Minutes</Label>
                    <Input
                      type="number"
                      min={15}
                      max={480}
                      step={15}
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Available Time Slots */}
          <div>
            <Label>Available Times</Label>
            {loadingSlots ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : freeSlots?.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">
                No free slots available for this duration
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 mt-2 max-h-48 overflow-y-auto">
                {freeSlots?.map((slot) => (
                  <Button
                    key={slot.start}
                    variant={selectedTime === slot.start ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTime(slot.start)}
                    className={cn(
                      slot.hasConflict && "border-orange-300 bg-orange-50"
                    )}
                  >
                    {slot.start}
                    {slot.hasConflict && (
                      <AlertTriangle className="h-3 w-3 ml-1 text-orange-500" />
                    )}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes for this time block..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!selectedTime || createTimeBlock.isPending}
          >
            {createTimeBlock.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CalendarPlus className="h-4 w-4 mr-2" />
            )}
            Create Time Block
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### User Work Settings Helper

```typescript
// Reuse work settings from Story 6.2
import { getUserWorkSettings, DEFAULT_WORK_SETTINGS } from "@/lib/user-settings";

// Re-export for convenience
export { getUserWorkSettings, DEFAULT_WORK_SETTINGS };
```

### Free Slots Calculation

```typescript
interface FreeSlot {
  start: string;  // "09:00"
  end: string;    // "10:00"
  hasConflict: boolean;
}

const SLOT_INCREMENT = 30; // minutes

async function getFreeSlots(
  userId: string,
  date: Date,
  minDuration: number
): Promise<FreeSlot[]> {
  // Get user's work hour settings
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  });
  const workSettings = getUserWorkSettings(user as User);
  const WORK_START_HOUR = workSettings.workStartHour;
  const WORK_END_HOUR = workSettings.workEndHour;

  // Get calendar account
  const account = await prisma.calendarAccount.findFirst({
    where: { userId, isDefault: true },
  });

  if (!account) {
    // No calendar connected - return all work hours as available
    return generateWorkHourSlots(date, minDuration, WORK_START_HOUR, WORK_END_HOUR);
  }

  // Fetch events for the day
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const events = await prisma.calendarEvent.findMany({
    where: {
      calendarAccountId: account.id,
      startTime: { gte: dayStart },
      endTime: { lte: dayEnd },
      status: { not: "cancelled" },
    },
    orderBy: { startTime: "asc" },
  });

  // Generate slots and mark conflicts
  const slots: FreeSlot[] = [];
  let currentTime = new Date(date);
  currentTime.setHours(WORK_START_HOUR, 0, 0, 0);

  const workEnd = new Date(date);
  workEnd.setHours(WORK_END_HOUR, 0, 0, 0);

  while (currentTime < workEnd) {
    const slotEnd = addMinutes(currentTime, minDuration);

    if (slotEnd > workEnd) break;

    // Check for conflicts
    const hasConflict = events.some((event) => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      return (
        (currentTime >= eventStart && currentTime < eventEnd) ||
        (slotEnd > eventStart && slotEnd <= eventEnd) ||
        (currentTime <= eventStart && slotEnd >= eventEnd)
      );
    });

    // Only add slot if it's in the future
    if (currentTime > new Date()) {
      slots.push({
        start: format(currentTime, "HH:mm"),
        end: format(slotEnd, "HH:mm"),
        hasConflict,
      });
    }

    currentTime = addMinutes(currentTime, SLOT_INCREMENT);
  }

  // Filter: show non-conflicting slots always, show conflicting slots only
  // when calendar is relatively free (fewer than 8 events) to suggest alternatives
  return slots.filter((slot) => !slot.hasConflict || events.length < 8);
}

function generateWorkHourSlots(
  date: Date,
  minDuration: number,
  workStartHour: number = DEFAULT_WORK_SETTINGS.workStartHour,
  workEndHour: number = DEFAULT_WORK_SETTINGS.workEndHour
): FreeSlot[] {
  const slots: FreeSlot[] = [];
  let currentTime = new Date(date);
  currentTime.setHours(workStartHour, 0, 0, 0);

  const workEnd = new Date(date);
  workEnd.setHours(workEndHour, 0, 0, 0);

  while (currentTime < workEnd) {
    const slotEnd = addMinutes(currentTime, minDuration);
    if (slotEnd > workEnd) break;

    if (currentTime > new Date()) {
      slots.push({
        start: format(currentTime, "HH:mm"),
        end: format(slotEnd, "HH:mm"),
        hasConflict: false,
      });
    }

    currentTime = addMinutes(currentTime, SLOT_INCREMENT);
  }

  return slots;
}
```

### Time Block Creation Service

```typescript
interface CreateTimeBlockInput {
  actionId: string;
  startTime: Date;
  duration: number; // minutes
  notes?: string;
}

async function createTimeBlock(
  userId: string,
  input: CreateTimeBlockInput
): Promise<{ eventId: string; calendarEventId: string }> {
  // Get calendar account
  const account = await prisma.calendarAccount.findFirst({
    where: { userId, isDefault: true },
  });

  if (!account) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No calendar connected. Connect a calendar to schedule time blocks.",
    });
  }

  // Get the action
  const action = await prisma.action.findUnique({
    where: { id: input.actionId, userId },
  });

  if (!action) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Action not found",
    });
  }

  // Calculate end time
  const endTime = addMinutes(input.startTime, input.duration);

  // Create event in provider
  const calendarClient = await getCalendarClient(account);

  const eventData = {
    title: `🎯 ${action.description}`,
    description: buildEventDescription(action, input.notes),
    startTime: input.startTime,
    endTime,
    location: "", // Time blocks typically don't have a location
  };

  const externalEvent = await calendarClient.createEvent(eventData);

  // Store in local database
  const calendarEvent = await prisma.calendarEvent.create({
    data: {
      calendarAccountId: account.id,
      externalId: externalEvent.id,
      title: eventData.title,
      description: eventData.description,
      startTime: input.startTime,
      endTime,
      isAllDay: false,
      status: "confirmed",
      lastSyncedAt: new Date(),
    },
  });

  // Link action to calendar event
  await prisma.action.update({
    where: { id: input.actionId },
    data: {
      calendarEventId: calendarEvent.id,
      scheduledFor: input.startTime,
    },
  });

  return {
    eventId: calendarEvent.id,
    calendarEventId: externalEvent.id,
  };
}

function buildEventDescription(action: Action, notes?: string): string {
  let description = `Time block for action from Bee.\n\n`;

  if (action.description) {
    description += `Action details:\n${action.description}\n\n`;
  }

  if (notes) {
    description += `Notes:\n${notes}\n\n`;
  }

  description += `---\nManaged by Bee PKM`;

  return description;
}
```

### Calendar Provider Event Creation

```typescript
// CalDAV Event Creation
async function createCalDAVEvent(
  client: DAVClient,
  calendarUrl: string,
  event: CalendarEventInput
): Promise<{ id: string }> {
  const uid = `bee-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const vcalendar = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Bee PKM//Time Block//EN
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatICALDate(new Date())}
DTSTART:${formatICALDate(event.startTime)}
DTEND:${formatICALDate(event.endTime)}
SUMMARY:${escapeICALText(event.title)}
DESCRIPTION:${escapeICALText(event.description || "")}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

  await client.createCalendarObject({
    calendar: { url: calendarUrl },
    filename: `${uid}.ics`,
    iCalString: vcalendar,
  });

  return { id: uid };
}

// Microsoft Graph Event Creation
async function createMSGraphEvent(
  accessToken: string,
  event: CalendarEventInput
): Promise<{ id: string }> {
  const response = await fetch(
    "https://graph.microsoft.com/v1.0/me/calendar/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject: event.title,
        body: {
          contentType: "Text",
          content: event.description || "",
        },
        start: {
          dateTime: event.startTime.toISOString(),
          timeZone: "UTC",
        },
        end: {
          dateTime: event.endTime.toISOString(),
          timeZone: "UTC",
        },
        showAs: "busy",
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create event: ${response.statusText}`);
  }

  const result = await response.json();
  return { id: result.id };
}
```

### Action Card Time Block Button

```tsx
function ActionCard({ action }: { action: Action }) {
  const [showTimeBlockModal, setShowTimeBlockModal] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{action.description}</CardTitle>
        {action.scheduledFor && (
          <Badge variant="secondary">
            <CalendarClock className="h-3 w-3 mr-1" />
            {format(action.scheduledFor, "EEE, MMM d 'at' h:mm a")}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {action.description && (
          <p className="text-sm text-gray-600">{action.description}</p>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="flex gap-2">
          {!action.scheduledFor ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTimeBlockModal(true)}
            >
              <CalendarPlus className="h-4 w-4 mr-1" />
              Schedule
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTimeBlockModal(true)}
            >
              <CalendarClock className="h-4 w-4 mr-1" />
              Reschedule
            </Button>
          )}
        </div>
        <Button variant="ghost" size="sm">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </CardFooter>

      <TimeBlockModal
        action={action}
        open={showTimeBlockModal}
        onClose={() => setShowTimeBlockModal(false)}
        onCreated={() => {
          // Refresh action data
        }}
      />
    </Card>
  );
}
```

### tRPC Procedures

```typescript
export const calendarRouter = router({
  // ... existing procedures ...

  getFreeSlots: protectedProcedure
    .input(z.object({
      date: z.date(),
      minDuration: z.number().min(15).max(480).default(60),
    }))
    .query(async ({ ctx, input }) => {
      return getFreeSlots(ctx.session.user.id, input.date, input.minDuration);
    }),

  createTimeBlock: protectedProcedure
    .input(z.object({
      actionId: z.string(),
      startTime: z.date(),
      duration: z.number().min(15).max(480),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return createTimeBlock(ctx.session.user.id, input);
    }),

  deleteTimeBlock: protectedProcedure
    .input(z.object({
      actionId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const action = await prisma.action.findUnique({
        where: { id: input.actionId, userId: ctx.session.user.id },
        include: { calendarEvent: true },
      });

      if (!action?.calendarEvent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Time block not found",
        });
      }

      // Delete from provider
      const account = await prisma.calendarAccount.findFirst({
        where: { id: action.calendarEvent.calendarAccountId },
      });

      if (account) {
        const client = await getCalendarClient(account);
        await client.deleteEvent(action.calendarEvent.externalId);
      }

      // Remove link and local record
      await prisma.$transaction([
        prisma.action.update({
          where: { id: input.actionId },
          data: { calendarEventId: null, scheduledFor: null },
        }),
        prisma.calendarEvent.delete({
          where: { id: action.calendarEvent.id },
        }),
      ]);

      return { success: true };
    }),
});
```

### Schema Updates

```prisma
// In Action model - add calendar link
model Action {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  title           String
  description     String?
  status          ActionStatus @default(PENDING)
  priority        ActionPriority @default(MEDIUM)
  dueDate         DateTime?

  // Calendar integration
  scheduledFor    DateTime?
  calendarEventId String?   @unique
  calendarEvent   CalendarEvent? @relation(fields: [calendarEventId], references: [id])

  // ... other fields ...

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

## Dependencies

- Story 6.1 (Calendar Integration - Read)
- Story 4.2 (Action items from swipe review)

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/web/src/components/calendar/time-block-modal.tsx` | Create | Time block creation dialog |
| `apps/web/src/server/services/calendar.service.ts` | Modify | Add createTimeBlock, getFreeSlots |
| `apps/web/src/server/routers/calendar.ts` | Modify | Add getFreeSlots, createTimeBlock, deleteTimeBlock |
| `apps/web/src/components/actions/action-card.tsx` | Modify | Add schedule button |
| `packages/db/prisma/schema.prisma` | Modify | Add scheduledFor, calendarEventId to Action |

## Testing Checklist

- [ ] Free slots calculated correctly based on existing events
- [ ] Time block created in connected calendar
- [ ] CalDAV event creation works
- [ ] MS Graph event creation works
- [ ] Action linked to calendar event
- [ ] Conflict warning displayed for overlapping slots
- [ ] Custom duration input validates correctly
- [ ] Time block can be deleted
- [ ] Works without calendar connected (shows error)
- [ ] Past time slots not shown

## Definition of Done

- [ ] Time block modal component
- [ ] Free slot calculation service
- [ ] CalDAV event creation
- [ ] Microsoft Graph event creation
- [ ] Action-to-event linking
- [ ] Conflict detection
- [ ] Duration presets (30m, 1h, 2h, custom)
- [ ] Delete time block functionality
- [ ] TypeScript/ESLint pass
- [ ] Unit tests for slot calculation

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-11 | 1.0 | Initial story specification | Bob (SM) |
