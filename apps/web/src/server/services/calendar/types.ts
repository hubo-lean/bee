export interface Attendee {
  email: string;
  name?: string;
  status: "accepted" | "declined" | "tentative" | "needsAction";
}

export interface CalendarEventInput {
  externalId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  timezone: string;
  status: string;
  attendees?: Attendee[] | null;
  recurrence?: string | null;
  rawData?: unknown;
}

export interface CalendarProvider {
  connect(account: CalendarAccountData): Promise<void>;
  fetchEvents(dateRange: { start: Date; end: Date }): Promise<CalendarEventInput[]>;
  createEvent(event: CreateEventInput): Promise<{ id: string }>;
  deleteEvent?(externalId: string): Promise<void>;
  disconnect?(): Promise<void>;
}

export interface CalendarAccountData {
  id: string;
  userId: string;
  provider: string;
  calendarUrl?: string | null;
  caldavUsername?: string | null;
  caldavPassword?: string | null;
  oauthAccessToken?: string | null;
  oauthRefreshToken?: string | null;
  oauthExpiresAt?: Date | null;
}

export interface DailyMeetingHours {
  date: Date;
  hours: number;
  isOverloaded: boolean;
}

export interface CalendarSummary {
  weekStart: Date;
  weekEnd: Date;
  totalMeetingHours: number;
  totalFocusHours: number;
  meetingPercentage: number;
  dailyMeetingHours: DailyMeetingHours[];
  busiestDay: { date: Date; hours: number };
  lightestDay: { date: Date; hours: number };
  eventCount: number;
  averageMeetingDuration: number;
  longestMeeting: { title: string; duration: number };
  isOverloaded: boolean;
  hasBackToBack: boolean;
}

export interface FreeSlot {
  start: string;
  end: string;
  hasConflict: boolean;
}

export interface CreateTimeBlockInput {
  actionId: string;
  startTime: Date;
  duration: number;
  notes?: string;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
}
