# Story 6.1: Calendar Integration (Read)

## Story

**As a** user,
**I want** to see my calendar within the app,
**So that** I can plan my week with time awareness.

## Priority

**P0** - Foundation for all calendar features

## Acceptance Criteria

1. Calendar view shows events from Microsoft Outlook (or CalDAV provider)
2. Week view and day view toggle
3. Events display: title, time, duration, meeting attendees
4. Calendar fetched via CalDAV or Microsoft Graph API
5. Refresh button to sync latest events
6. Calendar accessible from main navigation
7. Graceful error handling when calendar provider is unavailable or credentials are invalid

## Technical Design

### Calendar Provider Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CalendarService                       │
├─────────────────────────────────────────────────────────┤
│  fetchEvents(accountId, dateRange)                       │
│  syncCalendar(accountId)                                 │
│  getProviderClient(account) → CalDAVClient | GraphClient │
└─────────────────────────────────────────────────────────┘
           ↓                              ↓
┌─────────────────────┐      ┌─────────────────────────────┐
│    CalDAVClient     │      │    MicrosoftGraphClient     │
│  (tsdav library)    │      │  (Microsoft OAuth)          │
├─────────────────────┤      ├─────────────────────────────┤
│  Gmail CalDAV       │      │  Outlook Calendar           │
│  iCloud CalDAV      │      │  via Graph API              │
│  Fastmail CalDAV    │      │                             │
└─────────────────────┘      └─────────────────────────────┘
```

### Database Schema

```prisma
model CalendarEvent {
  id                String   @id @default(uuid())
  calendarAccountId String
  calendarAccount   CalendarAccount @relation(fields: [calendarAccountId], references: [id], onDelete: Cascade)
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  externalId        String   // Provider's event ID
  title             String
  description       String?
  location          String?

  startTime         DateTime
  endTime           DateTime
  isAllDay          Boolean  @default(false)
  timezone          String   @default("UTC")

  status            String   @default("confirmed") // confirmed, tentative, cancelled
  attendees         Json?    // Attendee[]
  recurrence        String?  // RRULE string

  rawData           Json?    // Original event data for debugging
  lastSyncedAt      DateTime @default(now())

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([calendarAccountId, externalId])
  @@index([userId, startTime, endTime])
}
```

### Encryption Utilities

```typescript
// apps/web/src/lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Derive key from environment secret
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error("ENCRYPTION_SECRET environment variable is required");
  }
  return scryptSync(secret, "salt", KEY_LENGTH);
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export async function decrypt(encryptedData: string): Promise<string> {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encrypted] = encryptedData.split(":");

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error("Invalid encrypted data format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
```

### CalDAV Integration (tsdav)

```typescript
import { createDAVClient, DAVCalendar, DAVObject } from "tsdav";
import { decrypt } from "@/lib/encryption";

class CalDAVCalendarClient {
  private client: ReturnType<typeof createDAVClient>;

  async connect(account: CalendarAccount) {
    try {
      this.client = await createDAVClient({
        serverUrl: account.caldavUrl!,
        credentials: {
          username: account.username!,
          password: await decrypt(account.caldavPassword!),
        },
        authMethod: "Basic",
        defaultAccountType: "caldav",
      });
    } catch (error) {
      throw new CalendarConnectionError(
        "Failed to connect to CalDAV server",
        { cause: error, provider: "caldav" }
      );
    }
  }

  async fetchEvents(dateRange: { start: Date; end: Date }): Promise<CalendarEvent[]> {
    const calendars = await this.client.fetchCalendars();
    const primaryCalendar = calendars[0]; // Use first calendar

    const calendarObjects = await this.client.fetchCalendarObjects({
      calendar: primaryCalendar,
      timeRange: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      },
    });

    return calendarObjects.map((obj) => this.parseICalEvent(obj));
  }

  private parseICalEvent(calObject: DAVObject): CalendarEvent {
    // Parse VCALENDAR/VEVENT data
    const ical = ICAL.parse(calObject.data);
    const vevent = ical.getFirstSubcomponent("vevent");

    return {
      externalId: vevent.getFirstPropertyValue("uid"),
      title: vevent.getFirstPropertyValue("summary") || "Untitled",
      description: vevent.getFirstPropertyValue("description"),
      location: vevent.getFirstPropertyValue("location"),
      startTime: vevent.getFirstPropertyValue("dtstart").toJSDate(),
      endTime: vevent.getFirstPropertyValue("dtend").toJSDate(),
      isAllDay: !vevent.getFirstPropertyValue("dtstart").isDate === false,
      status: vevent.getFirstPropertyValue("status")?.toLowerCase() || "confirmed",
      attendees: this.parseAttendees(vevent),
      recurrence: vevent.getFirstPropertyValue("rrule")?.toString(),
      rawData: calObject.data,
    };
  }

  private parseAttendees(vevent: ICAL.Component): Attendee[] {
    const attendees = vevent.getAllProperties("attendee");
    return attendees.map((att) => ({
      email: att.getFirstValue().replace("mailto:", ""),
      name: att.getParameter("cn"),
      status: this.mapPartstat(att.getParameter("partstat")),
    }));
  }
}
```

### Custom Error Classes

```typescript
// apps/web/src/lib/errors/calendar.ts
export class CalendarConnectionError extends Error {
  constructor(
    message: string,
    public readonly details: { cause?: unknown; provider: string }
  ) {
    super(message);
    this.name = "CalendarConnectionError";
  }
}

export class CalendarAuthError extends Error {
  constructor(
    message: string,
    public readonly details: { provider: string; needsReauth: boolean }
  ) {
    super(message);
    this.name = "CalendarAuthError";
  }
}
```

### Microsoft Graph Integration

```typescript
import { Client } from "@microsoft/microsoft-graph-client";
import { decrypt, encrypt } from "@/lib/encryption";
import { CalendarConnectionError, CalendarAuthError } from "@/lib/errors/calendar";

// Token refresh buffer - refresh 5 minutes before expiry
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

class MicrosoftCalendarClient {
  private client: Client;

  async connect(account: CalendarAccount) {
    try {
      const accessToken = await this.getValidToken(account);

      this.client = Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        },
      });
    } catch (error) {
      if (error instanceof CalendarAuthError) {
        throw error;
      }
      throw new CalendarConnectionError(
        "Failed to connect to Microsoft Graph",
        { cause: error, provider: "microsoft_oauth" }
      );
    }
  }

  async fetchEvents(dateRange: { start: Date; end: Date }): Promise<CalendarEvent[]> {
    try {
      const response = await this.client
        .api("/me/calendarview")
        .query({
          startDateTime: dateRange.start.toISOString(),
          endDateTime: dateRange.end.toISOString(),
        })
        .select("id,subject,body,start,end,location,attendees,isAllDay,showAs,recurrence")
        .orderby("start/dateTime")
        .top(100)
        .get();

      return response.value.map((event: any) => ({
        externalId: event.id,
        title: event.subject || "Untitled",
        description: event.body?.content,
        location: event.location?.displayName,
        startTime: new Date(event.start.dateTime + "Z"),
        endTime: new Date(event.end.dateTime + "Z"),
        isAllDay: event.isAllDay,
        status: this.mapShowAs(event.showAs),
        attendees: event.attendees?.map((a: any) => ({
          email: a.emailAddress.address,
          name: a.emailAddress.name,
          status: this.mapResponseStatus(a.status.response),
        })) || [],
        recurrence: event.recurrence ? JSON.stringify(event.recurrence) : null,
        rawData: event,
      }));
    } catch (error: any) {
      // Handle rate limiting with exponential backoff
      if (error.statusCode === 429) {
        const retryAfter = error.headers?.["retry-after"] || 60;
        throw new CalendarConnectionError(
          `Rate limited. Retry after ${retryAfter} seconds`,
          { cause: error, provider: "microsoft_oauth" }
        );
      }
      throw error;
    }
  }

  private async getValidToken(account: CalendarAccount): Promise<string> {
    const now = new Date();
    const expiresAt = account.oauthExpiresAt ? new Date(account.oauthExpiresAt) : null;

    // Check if access token is expired or will expire soon
    const needsRefresh = expiresAt &&
      (expiresAt.getTime() - now.getTime()) < TOKEN_REFRESH_BUFFER_MS;

    if (needsRefresh) {
      // Check if refresh token exists
      if (!account.oauthRefreshToken) {
        throw new CalendarAuthError(
          "No refresh token available. User needs to re-authenticate.",
          { provider: "microsoft_oauth", needsReauth: true }
        );
      }

      // Refresh the token
      return await this.refreshToken(account);
    }

    if (!account.oauthAccessToken) {
      throw new CalendarAuthError(
        "No access token available. User needs to authenticate.",
        { provider: "microsoft_oauth", needsReauth: true }
      );
    }

    return await decrypt(account.oauthAccessToken);
  }

  private async refreshToken(account: CalendarAccount): Promise<string> {
    try {
      const refreshToken = await decrypt(account.oauthRefreshToken!);

      const response = await fetch(
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.MICROSOFT_CLIENT_ID!,
            client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
            scope: "https://graph.microsoft.com/Calendars.Read offline_access",
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        // If refresh token is invalid/expired, user needs to re-auth
        if (error.error === "invalid_grant") {
          throw new CalendarAuthError(
            "Refresh token expired. User needs to re-authenticate.",
            { provider: "microsoft_oauth", needsReauth: true }
          );
        }
        throw new Error(`Token refresh failed: ${error.error_description}`);
      }

      const tokens = await response.json();

      // Update stored tokens
      await prisma.calendarAccount.update({
        where: { id: account.id },
        data: {
          oauthAccessToken: await encrypt(tokens.access_token),
          oauthRefreshToken: tokens.refresh_token
            ? await encrypt(tokens.refresh_token)
            : account.oauthRefreshToken,
          oauthExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        },
      });

      return tokens.access_token;
    } catch (error) {
      if (error instanceof CalendarAuthError) {
        throw error;
      }
      throw new CalendarConnectionError(
        "Failed to refresh Microsoft token",
        { cause: error, provider: "microsoft_oauth" }
      );
    }
  }
}
```

### Calendar Service

```typescript
class CalendarService {
  async fetchEvents(
    userId: string,
    accountId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<CalendarEvent[]> {
    const account = await prisma.calendarAccount.findUnique({
      where: { id: accountId, userId },
    });

    if (!account) {
      throw new Error("Calendar account not found");
    }

    // Get appropriate client
    const client = this.getProviderClient(account);
    await client.connect(account);

    // Fetch events from provider
    const events = await client.fetchEvents(dateRange);

    // Upsert events to local cache
    await this.upsertEvents(account.id, userId, events);

    return events;
  }

  async syncCalendar(accountId: string): Promise<{ synced: number }> {
    const account = await prisma.calendarAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error("Calendar account not found");
    }

    // Sync next 30 days
    const dateRange = {
      start: startOfDay(new Date()),
      end: addDays(new Date(), 30),
    };

    const events = await this.fetchEvents(account.userId, accountId, dateRange);

    // Update sync status
    await prisma.calendarAccount.update({
      where: { id: accountId },
      data: {
        lastSyncAt: new Date(),
        syncStatus: "idle",
        syncError: null,
      },
    });

    return { synced: events.length };
  }

  private getProviderClient(account: CalendarAccount) {
    switch (account.provider) {
      case "caldav":
        return new CalDAVCalendarClient();
      case "microsoft_oauth":
        return new MicrosoftCalendarClient();
      case "google_oauth":
        return new GoogleCalendarClient();
      default:
        throw new Error(`Unknown provider: ${account.provider}`);
    }
  }

  private async upsertEvents(
    accountId: string,
    userId: string,
    events: CalendarEvent[]
  ) {
    for (const event of events) {
      await prisma.calendarEvent.upsert({
        where: {
          calendarAccountId_externalId: {
            calendarAccountId: accountId,
            externalId: event.externalId,
          },
        },
        create: {
          ...event,
          calendarAccountId: accountId,
          userId,
          lastSyncedAt: new Date(),
        },
        update: {
          ...event,
          lastSyncedAt: new Date(),
        },
      });
    }
  }
}
```

### Calendar Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Calendar                           [Week] [Day]  [🔄 Sync] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│     Mon 13    Tue 14    Wed 15    Thu 16    Fri 17         │
│  ┌─────────┬─────────┬─────────┬─────────┬─────────┐       │
│  │ 9:00    │         │ 9:00    │         │ 10:00   │       │
│  │ Team    │         │ Sprint  │         │ Client  │       │
│  │ Standup │         │ Planning│         │ Call    │       │
│  │         │         │         │         │         │       │
│  ├─────────┤         ├─────────┤         ├─────────┤       │
│  │ 11:00   │         │         │         │         │       │
│  │ 1:1     │         │         │         │         │       │
│  │ with    │         │         │         │         │       │
│  │ Manager │         │         │         │         │       │
│  └─────────┴─────────┴─────────┴─────────┴─────────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Calendar Page Component

```tsx
function CalendarPage() {
  const [view, setView] = useState<"week" | "day">("week");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const dateRange = useMemo(() => {
    if (view === "week") {
      return {
        start: startOfWeek(selectedDate, { weekStartsOn: 1 }),
        end: endOfWeek(selectedDate, { weekStartsOn: 1 }),
      };
    }
    return {
      start: startOfDay(selectedDate),
      end: endOfDay(selectedDate),
    };
  }, [view, selectedDate]);

  const { data: events, isLoading, refetch } = trpc.calendar.getEvents.useQuery({
    dateRange,
  });

  const { data: account } = trpc.calendar.getAccounts.useQuery();
  const syncMutation = trpc.calendar.syncCalendar.useMutation();

  const handleSync = async () => {
    if (account?.id) {
      await syncMutation.mutateAsync({ accountId: account.id });
      refetch();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex items-center gap-4">
          {/* View Toggle */}
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v)}>
            <ToggleGroupItem value="week">Week</ToggleGroupItem>
            <ToggleGroupItem value="day">Day</ToggleGroupItem>
          </ToggleGroup>

          {/* Sync Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", syncMutation.isPending && "animate-spin")} />
            Sync
          </Button>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-between p-4 border-b">
        <Button variant="ghost" onClick={() => setSelectedDate(addWeeks(selectedDate, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-semibold">
          {format(dateRange.start, "MMM d")} - {format(dateRange.end, "MMM d, yyyy")}
        </h2>
        <Button variant="ghost" onClick={() => setSelectedDate(addWeeks(selectedDate, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <CalendarSkeleton view={view} />
        ) : view === "week" ? (
          <WeekView
            events={events || []}
            dateRange={dateRange}
            onEventClick={setSelectedEvent}
          />
        ) : (
          <DayView
            events={events || []}
            date={selectedDate}
            onEventClick={setSelectedEvent}
          />
        )}
      </div>

      {/* Event Detail Sheet */}
      <EventDetailSheet
        event={selectedEvent}
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />

      {/* No Account Setup */}
      {!account && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="font-semibold mb-2">Connect Your Calendar</h3>
              <p className="text-sm text-gray-500 mb-4">
                Link your calendar to see events and schedule time blocks.
              </p>
              <Button asChild>
                <Link href="/settings/calendar">Connect Calendar</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
```

### Week View Component

```tsx
function WeekView({
  events,
  dateRange,
  onEventClick,
}: {
  events: CalendarEvent[];
  dateRange: { start: Date; end: Date };
  onEventClick: (event: CalendarEvent) => void;
}) {
  const days = eachDayOfInterval(dateRange);
  const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8am - 8pm

  // Group events by day
  const eventsByDay = useMemo(() => {
    return days.reduce((acc, day) => {
      acc[format(day, "yyyy-MM-dd")] = events.filter((e) =>
        isSameDay(new Date(e.startTime), day)
      );
      return acc;
    }, {} as Record<string, CalendarEvent[]>);
  }, [events, days]);

  return (
    <div className="grid grid-cols-[60px_repeat(5,1fr)] gap-px bg-gray-200">
      {/* Time column */}
      <div className="bg-white">
        <div className="h-12" /> {/* Header spacer */}
        {hours.map((hour) => (
          <div key={hour} className="h-16 text-xs text-gray-500 text-right pr-2 pt-1">
            {format(new Date().setHours(hour, 0), "h a")}
          </div>
        ))}
      </div>

      {/* Day columns */}
      {days.map((day) => (
        <div key={day.toISOString()} className="bg-white">
          {/* Day header */}
          <div className={cn(
            "h-12 flex flex-col items-center justify-center border-b",
            isToday(day) && "bg-blue-50"
          )}>
            <span className="text-xs text-gray-500">{format(day, "EEE")}</span>
            <span className={cn(
              "text-lg font-semibold",
              isToday(day) && "text-blue-600"
            )}>
              {format(day, "d")}
            </span>
          </div>

          {/* Events */}
          <div className="relative">
            {hours.map((hour) => (
              <div key={hour} className="h-16 border-b border-gray-100" />
            ))}

            {/* Position events */}
            {eventsByDay[format(day, "yyyy-MM-dd")]?.map((event) => (
              <EventBlock
                key={event.id}
                event={event}
                onClick={() => onEventClick(event)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EventBlock({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick: () => void;
}) {
  const startHour = new Date(event.startTime).getHours();
  const startMinute = new Date(event.startTime).getMinutes();
  const durationMinutes = differenceInMinutes(
    new Date(event.endTime),
    new Date(event.startTime)
  );

  const top = (startHour - 8) * 64 + (startMinute / 60) * 64;
  const height = (durationMinutes / 60) * 64;

  return (
    <button
      onClick={onClick}
      className="absolute left-1 right-1 bg-blue-100 border-l-4 border-blue-500 rounded px-2 py-1 text-left overflow-hidden hover:bg-blue-200 transition-colors"
      style={{ top: `${top}px`, height: `${Math.max(height, 24)}px` }}
    >
      <p className="text-xs font-medium text-blue-900 truncate">{event.title}</p>
      {height > 32 && (
        <p className="text-xs text-blue-700">
          {format(new Date(event.startTime), "h:mm a")}
        </p>
      )}
    </button>
  );
}
```

### Event Detail Sheet

```tsx
function EventDetailSheet({
  event,
  open,
  onClose,
}: {
  event: CalendarEvent | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!event) return null;

  const duration = differenceInMinutes(
    new Date(event.endTime),
    new Date(event.startTime)
  );

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{event.title}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          {/* Time */}
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="font-medium">
                {format(new Date(event.startTime), "EEEE, MMMM d")}
              </p>
              <p className="text-sm text-gray-500">
                {format(new Date(event.startTime), "h:mm a")} -{" "}
                {format(new Date(event.endTime), "h:mm a")}
                <span className="ml-2">({duration} minutes)</span>
              </p>
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <p>{event.location}</p>
            </div>
          )}

          {/* Attendees */}
          {event.attendees && event.attendees.length > 0 && (
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium mb-2">
                  {event.attendees.length} attendee{event.attendees.length !== 1 && "s"}
                </p>
                <div className="space-y-1">
                  {event.attendees.map((attendee, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <AttendeeStatusIcon status={attendee.status} />
                      <span>{attendee.name || attendee.email}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="prose prose-sm max-w-none">
                <p>{event.description}</p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

### tRPC Procedures

```typescript
export const calendarRouter = router({
  getAccounts: protectedProcedure.query(async ({ ctx }) => {
    return prisma.calendarAccount.findFirst({
      where: { userId: ctx.session.user.id, isDefault: true },
    });
  }),

  getEvents: protectedProcedure
    .input(z.object({
      dateRange: z.object({
        start: z.date(),
        end: z.date(),
      }),
      accountId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Get from local cache first
      const events = await prisma.calendarEvent.findMany({
        where: {
          userId: ctx.session.user.id,
          calendarAccountId: input.accountId,
          startTime: { gte: input.dateRange.start },
          endTime: { lte: input.dateRange.end },
          status: { not: "cancelled" },
        },
        orderBy: { startTime: "asc" },
      });

      return events;
    }),

  syncCalendar: protectedProcedure
    .input(z.object({ accountId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const calendarService = new CalendarService();
      return calendarService.syncCalendar(input.accountId);
    }),
});
```

## Dependencies

- tsdav (CalDAV client)
- @microsoft/microsoft-graph-client (MS Graph)
- ical.js (iCal parsing)
- date-fns (date manipulation)

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/db/prisma/schema.prisma` | Modify | Add CalendarEvent model |
| `apps/web/src/server/services/calendar.service.ts` | Create | Calendar business logic |
| `apps/web/src/server/services/calendar/caldav-client.ts` | Create | CalDAV provider |
| `apps/web/src/server/services/calendar/microsoft-client.ts` | Create | MS Graph provider |
| `apps/web/src/server/routers/calendar.ts` | Create | tRPC calendar procedures |
| `apps/web/src/app/(app)/calendar/page.tsx` | Create | Calendar page |
| `apps/web/src/components/calendar/week-view.tsx` | Create | Week view component |
| `apps/web/src/components/calendar/day-view.tsx` | Create | Day view component |
| `apps/web/src/components/calendar/event-block.tsx` | Create | Event display |
| `apps/web/src/components/calendar/event-detail-sheet.tsx` | Create | Event details |

## Testing Checklist

- [ ] CalDAV connection works (Gmail, iCloud)
- [ ] Microsoft OAuth connection works
- [ ] Events display in week view
- [ ] Events display in day view
- [ ] Date navigation works
- [ ] Sync button fetches latest events
- [ ] Event detail sheet shows all info
- [ ] Attendees display correctly
- [ ] No account state shows connect prompt
- [ ] Events cached locally for offline

## Definition of Done

- [ ] Calendar page with week/day views
- [ ] CalDAV provider integration
- [ ] Microsoft Graph provider integration
- [ ] Event caching in database
- [ ] Sync functionality
- [ ] Event detail sheet
- [ ] Date navigation
- [ ] TypeScript/ESLint pass
- [ ] Integration tests for providers

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-11 | 1.0 | Initial story specification | Bob (SM) |
