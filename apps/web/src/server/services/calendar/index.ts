import { prisma, Prisma } from "@packages/db";
import {
  addDays,
  addMinutes,
  startOfDay,
  endOfDay,
  endOfWeek,
  eachDayOfInterval,
  isWeekend,
  isSameDay,
  differenceInMinutes,
  format,
} from "date-fns";
import { CalDAVCalendarClient } from "./caldav-client";
import { MicrosoftCalendarClient } from "./microsoft-client";
import { GoogleCalendarClient } from "./google-client";
import type {
  CalendarProvider,
  CalendarAccountData,
  CalendarEventInput,
  CalendarSummary,
  FreeSlot,
  CreateTimeBlockInput,
  CreateEventInput,
} from "./types";

// Default values (can be overridden by user settings)
const DEFAULT_WORK_HOURS_PER_DAY = 8;
const DEFAULT_WORK_DAYS_PER_WEEK = 5;
const DEFAULT_OVERLOADED_THRESHOLD = 30;
const DEFAULT_DAY_OVERLOADED_THRESHOLD = 6;
const DEFAULT_WORK_START_HOUR = 9;
const DEFAULT_WORK_END_HOUR = 18;
const SLOT_INCREMENT = 30; // minutes

/**
 * User calendar settings stored in user.settings JSON field
 */
interface UserCalendarSettings {
  workHoursPerDay?: number;
  workDaysPerWeek?: number;
  workStartHour?: number;
  workEndHour?: number;
  overloadedThreshold?: number;
  dayOverloadedThreshold?: number;
}

/**
 * Get user's calendar settings from their settings JSON field
 */
async function getUserCalendarSettings(userId: string): Promise<UserCalendarSettings> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  });

  if (!user?.settings || typeof user.settings !== "object") {
    return {};
  }

  const settings = user.settings as Record<string, unknown>;
  const calendar = settings.calendar as UserCalendarSettings | undefined;

  return calendar || {};
}

/**
 * Get effective work hours configuration for a user
 */
function getWorkHoursConfig(userSettings: UserCalendarSettings) {
  const workHoursPerDay = userSettings.workHoursPerDay ?? DEFAULT_WORK_HOURS_PER_DAY;
  const workDaysPerWeek = userSettings.workDaysPerWeek ?? DEFAULT_WORK_DAYS_PER_WEEK;

  return {
    workHoursPerDay,
    workDaysPerWeek,
    workHoursPerWeek: workHoursPerDay * workDaysPerWeek,
    workStartHour: userSettings.workStartHour ?? DEFAULT_WORK_START_HOUR,
    workEndHour: userSettings.workEndHour ?? DEFAULT_WORK_END_HOUR,
    overloadedThreshold: userSettings.overloadedThreshold ?? DEFAULT_OVERLOADED_THRESHOLD,
    dayOverloadedThreshold: userSettings.dayOverloadedThreshold ?? DEFAULT_DAY_OVERLOADED_THRESHOLD,
  };
}

export class CalendarService {
  async fetchEvents(
    userId: string,
    accountId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<CalendarEventInput[]> {
    const account = await prisma.calendarAccount.findUnique({
      where: { id: accountId, userId },
    });

    if (!account) {
      throw new Error("Calendar account not found");
    }

    const client = this.getProviderClient(account.provider);
    await client.connect(account as CalendarAccountData);

    try {
      const events = await client.fetchEvents(dateRange);
      await this.upsertEvents(accountId, userId, events);
      return events;
    } finally {
      await client.disconnect?.();
    }
  }

  async getEventsFromCache(
    userId: string,
    dateRange: { start: Date; end: Date },
    accountId?: string
  ) {
    return prisma.calendarEvent.findMany({
      where: {
        userId,
        ...(accountId && { calendarAccountId: accountId }),
        startTime: { gte: dateRange.start },
        endTime: { lte: dateRange.end },
        status: { not: "cancelled" },
      },
      orderBy: { startTime: "asc" },
    });
  }

  async syncCalendar(accountId: string): Promise<{ synced: number }> {
    const account = await prisma.calendarAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error("Calendar account not found");
    }

    // Update sync status to syncing
    await prisma.calendarAccount.update({
      where: { id: accountId },
      data: { syncStatus: "syncing", lastSyncError: null },
    });

    try {
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
          lastSyncError: null,
        },
      });

      return { synced: events.length };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await prisma.calendarAccount.update({
        where: { id: accountId },
        data: {
          syncStatus: "error",
          lastSyncError: errorMessage,
        },
      });
      throw error;
    }
  }

  async getAccounts(userId: string) {
    return prisma.calendarAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
  }

  async getDefaultAccount(userId: string) {
    return prisma.calendarAccount.findFirst({
      where: { userId, isDefault: true },
    });
  }

  async getSummary(userId: string, weekStart: Date): Promise<CalendarSummary | null> {
    const account = await this.getDefaultAccount(userId);
    if (!account) {
      return null;
    }

    // Get user's calendar settings
    const userSettings = await getUserCalendarSettings(userId);
    const config = getWorkHoursConfig(userSettings);

    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

    // Fetch events for the week
    const events = await prisma.calendarEvent.findMany({
      where: {
        userId,
        startTime: { gte: weekStart },
        endTime: { lte: weekEnd },
        status: "confirmed",
        isAllDay: false,
      },
    });

    // Calculate total meeting minutes
    const totalMinutes = events.reduce((sum, event) => {
      return (
        sum +
        differenceInMinutes(new Date(event.endTime), new Date(event.startTime))
      );
    }, 0);
    const totalMeetingHours = totalMinutes / 60;

    // Get work days only
    const workDays = eachDayOfInterval({ start: weekStart, end: weekEnd }).filter(
      (day) => !isWeekend(day)
    );

    // Calculate daily breakdown
    const dailyMeetingHours = workDays.map((day) => {
      const dayEvents = events.filter((e) =>
        isSameDay(new Date(e.startTime), day)
      );
      const minutes = dayEvents.reduce((sum, event) => {
        return (
          sum +
          differenceInMinutes(new Date(event.endTime), new Date(event.startTime))
        );
      }, 0);
      const hours = minutes / 60;

      return {
        date: day,
        hours,
        isOverloaded: hours > config.dayOverloadedThreshold,
      };
    });

    // Find busiest and lightest days
    const sortedDays = [...dailyMeetingHours].sort((a, b) => b.hours - a.hours);
    const busiestDay = sortedDays[0] || { date: weekStart, hours: 0 };
    const lightestDay = sortedDays[sortedDays.length - 1] || {
      date: weekStart,
      hours: 0,
    };

    // Calculate average meeting duration
    const averageMeetingDuration =
      events.length > 0 ? totalMinutes / events.length : 0;

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

    // Check for back-to-back meetings
    const hasBackToBack = workDays.some((day) => {
      const dayEvents = events
        .filter((e) => isSameDay(new Date(e.startTime), day))
        .sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );

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
      totalFocusHours: Math.max(config.workHoursPerWeek - totalMeetingHours, 0),
      meetingPercentage: (totalMeetingHours / config.workHoursPerWeek) * 100,
      dailyMeetingHours,
      busiestDay: { date: busiestDay.date, hours: busiestDay.hours },
      lightestDay: { date: lightestDay.date, hours: lightestDay.hours },
      eventCount: events.length,
      averageMeetingDuration,
      longestMeeting,
      isOverloaded: totalMeetingHours > config.overloadedThreshold,
      hasBackToBack,
    };
  }

  async getFreeSlots(
    userId: string,
    date: Date,
    minDuration: number
  ): Promise<FreeSlot[]> {
    // Get user's calendar settings
    const userSettings = await getUserCalendarSettings(userId);
    const config = getWorkHoursConfig(userSettings);

    const account = await this.getDefaultAccount(userId);

    if (!account) {
      // No calendar connected - return all work hours as available
      return this.generateWorkHourSlots(date, minDuration, config.workStartHour, config.workEndHour);
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
    const currentTime = new Date(date);
    currentTime.setHours(config.workStartHour, 0, 0, 0);

    const workEnd = new Date(date);
    workEnd.setHours(config.workEndHour, 0, 0, 0);

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

      currentTime.setTime(addMinutes(currentTime, SLOT_INCREMENT).getTime());
    }

    // Filter out conflicting slots, but keep them marked if user wants to see them
    return slots.filter((slot) => !slot.hasConflict || events.length < 8);
  }

  private generateWorkHourSlots(
    date: Date,
    minDuration: number,
    workStartHour: number = DEFAULT_WORK_START_HOUR,
    workEndHour: number = DEFAULT_WORK_END_HOUR
  ): FreeSlot[] {
    const slots: FreeSlot[] = [];
    const currentTime = new Date(date);
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

      currentTime.setTime(addMinutes(currentTime, SLOT_INCREMENT).getTime());
    }

    return slots;
  }

  async createTimeBlock(
    userId: string,
    input: CreateTimeBlockInput
  ): Promise<{ eventId: string; calendarEventId: string }> {
    // Get calendar account
    const account = await this.getDefaultAccount(userId);

    if (!account) {
      throw new Error(
        "No calendar connected. Connect a calendar to schedule time blocks."
      );
    }

    // Get the action
    const action = await prisma.action.findUnique({
      where: { id: input.actionId, userId },
    });

    if (!action) {
      throw new Error("Action not found");
    }

    // Calculate end time
    const endTime = addMinutes(input.startTime, input.duration);

    // Create event in provider
    const client = this.getProviderClient(account.provider);
    await client.connect(account as CalendarAccountData);

    try {
      const eventData: CreateEventInput = {
        title: `🎯 ${action.description}`,
        description: this.buildEventDescription(action.description, input.notes),
        startTime: input.startTime,
        endTime,
        location: "",
      };

      const externalEvent = await client.createEvent(eventData);

      // Store in local database
      const calendarEvent = await prisma.calendarEvent.create({
        data: {
          calendarAccountId: account.id,
          userId,
          externalId: externalEvent.id,
          title: eventData.title,
          description: eventData.description,
          startTime: input.startTime,
          endTime,
          isAllDay: false,
          timezone: "UTC",
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
    } finally {
      await client.disconnect?.();
    }
  }

  async deleteTimeBlock(userId: string, actionId: string): Promise<{ success: boolean }> {
    const action = await prisma.action.findUnique({
      where: { id: actionId, userId },
    });

    if (!action?.calendarEventId) {
      throw new Error("Time block not found");
    }

    // Get the calendar event
    const calendarEvent = await prisma.calendarEvent.findUnique({
      where: { id: action.calendarEventId },
    });

    if (!calendarEvent) {
      throw new Error("Calendar event not found");
    }

    // Get account to delete from provider
    const account = await prisma.calendarAccount.findFirst({
      where: { id: calendarEvent.calendarAccountId },
    });

    if (account) {
      const client = this.getProviderClient(account.provider);
      await client.connect(account as CalendarAccountData);
      try {
        await client.deleteEvent?.(calendarEvent.externalId);
      } finally {
        await client.disconnect?.();
      }
    }

    // Remove link and local record
    await prisma.$transaction([
      prisma.action.update({
        where: { id: actionId },
        data: { calendarEventId: null, scheduledFor: null },
      }),
      prisma.calendarEvent.delete({
        where: { id: calendarEvent.id },
      }),
    ]);

    return { success: true };
  }

  private buildEventDescription(
    actionDescription: string,
    notes?: string
  ): string {
    let description = `Time block for action from Bee.\n\n`;

    if (actionDescription) {
      description += `Action details:\n${actionDescription}\n\n`;
    }

    if (notes) {
      description += `Notes:\n${notes}\n\n`;
    }

    description += `---\nManaged by Bee PKM`;

    return description;
  }

  private getProviderClient(provider: string): CalendarProvider {
    switch (provider) {
      case "caldav":
        return new CalDAVCalendarClient();
      case "microsoft_oauth":
        return new MicrosoftCalendarClient();
      case "google_oauth":
        // Google Calendar support is not yet implemented - placeholder for future story
        return new GoogleCalendarClient();
      default:
        throw new Error(`Unknown calendar provider: ${provider}`);
    }
  }

  private async upsertEvents(
    accountId: string,
    userId: string,
    events: CalendarEventInput[]
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
          calendarAccountId: accountId,
          userId,
          externalId: event.externalId,
          title: event.title,
          description: event.description,
          location: event.location,
          startTime: event.startTime,
          endTime: event.endTime,
          isAllDay: event.isAllDay,
          timezone: event.timezone,
          status: event.status,
          attendees: (event.attendees as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          recurrence: event.recurrence,
          rawData: (event.rawData as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          lastSyncedAt: new Date(),
        },
        update: {
          title: event.title,
          description: event.description,
          location: event.location,
          startTime: event.startTime,
          endTime: event.endTime,
          isAllDay: event.isAllDay,
          timezone: event.timezone,
          status: event.status,
          attendees: (event.attendees as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          recurrence: event.recurrence,
          rawData: (event.rawData as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          lastSyncedAt: new Date(),
        },
      });
    }
  }
}

export const calendarService = new CalendarService();
export * from "./types";
