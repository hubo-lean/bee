import { createDAVClient, DAVObject } from "tsdav";
import ICAL from "ical.js";
import { decrypt } from "@/lib/encryption";
import type { CalendarProvider, CalendarEventInput, CalendarAccountData, Attendee, CreateEventInput } from "./types";

/**
 * Safely decrypt a password if it's encrypted (contains ':' separator from AES-GCM format)
 * Falls back to raw value if decryption fails (for backwards compatibility)
 */
function decryptPassword(encryptedPassword: string): string {
  // Check if it looks like an encrypted value (has the iv:authTag:encrypted format)
  if (encryptedPassword.includes(":") && encryptedPassword.split(":").length === 3) {
    try {
      return decrypt(encryptedPassword);
    } catch {
      // Fall back to raw value if decryption fails
      console.warn("CalDAV password decryption failed, using raw value");
      return encryptedPassword;
    }
  }
  return encryptedPassword;
}

export class CalDAVCalendarClient implements CalendarProvider {
  private client: Awaited<ReturnType<typeof createDAVClient>> | null = null;

  async connect(account: CalendarAccountData): Promise<void> {
    if (!account.calendarUrl) {
      throw new Error("CalDAV URL is required");
    }
    if (!account.caldavUsername || !account.caldavPassword) {
      throw new Error("CalDAV credentials are required");
    }

    // Decrypt password (stored encrypted with AES-256-GCM)
    const decryptedPassword = decryptPassword(account.caldavPassword);

    this.client = await createDAVClient({
      serverUrl: account.calendarUrl,
      credentials: {
        username: account.caldavUsername,
        password: decryptedPassword,
      },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });
  }

  async fetchEvents(dateRange: { start: Date; end: Date }): Promise<CalendarEventInput[]> {
    if (!this.client) {
      throw new Error("CalDAV client not connected");
    }

    const calendars = await this.client.fetchCalendars();
    if (!calendars.length) {
      return [];
    }

    const primaryCalendar = calendars[0];

    const calendarObjects = await this.client.fetchCalendarObjects({
      calendar: primaryCalendar,
      timeRange: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      },
    });

    const events: CalendarEventInput[] = [];
    for (const obj of calendarObjects) {
      try {
        const parsed = this.parseICalEvent(obj);
        if (parsed) {
          events.push(parsed);
        }
      } catch (err) {
        console.error("Failed to parse iCal event:", err);
      }
    }

    return events;
  }

  private parseICalEvent(calObject: DAVObject): CalendarEventInput | null {
    if (!calObject.data) {
      return null;
    }

    const jcalData = ICAL.parse(calObject.data);
    const comp = new ICAL.Component(jcalData);
    const vevent = comp.getFirstSubcomponent("vevent");

    if (!vevent) {
      return null;
    }

    const event = new ICAL.Event(vevent);
    const dtstart = vevent.getFirstProperty("dtstart");

    // Check if it's an all-day event
    const isAllDay = dtstart?.getParameter("value") === "DATE";

    // Get timezone parameter - it can be a string or array
    const tzidParam = dtstart?.getParameter("tzid");
    const timezone = typeof tzidParam === "string" ? tzidParam : "UTC";

    // Get status - can be various types from ical.js
    const statusValue = vevent.getFirstPropertyValue("status");
    const statusStr = typeof statusValue === "string" ? statusValue : null;

    return {
      externalId: event.uid || calObject.etag || crypto.randomUUID(),
      title: event.summary || "Untitled",
      description: event.description || null,
      location: event.location || null,
      startTime: event.startDate.toJSDate(),
      endTime: event.endDate?.toJSDate() || event.startDate.toJSDate(),
      isAllDay,
      timezone,
      status: this.mapStatus(statusStr),
      attendees: this.parseAttendees(vevent),
      recurrence: this.parseRecurrence(vevent),
      rawData: calObject.data,
    };
  }

  private mapStatus(status: string | null): string {
    if (!status) return "confirmed";
    const normalized = status.toLowerCase();
    if (normalized === "tentative") return "tentative";
    if (normalized === "cancelled") return "cancelled";
    return "confirmed";
  }

  private parseAttendees(vevent: ICAL.Component): Attendee[] {
    const attendees: Attendee[] = [];
    const props = vevent.getAllProperties("attendee");

    for (const prop of props) {
      const value = prop.getFirstValue();
      if (typeof value === "string") {
        const email = value.replace(/^mailto:/i, "");
        const cnParam = prop.getParameter("cn");
        const cn = typeof cnParam === "string" ? cnParam : undefined;
        const partstatParam = prop.getParameter("partstat");
        const partstat = typeof partstatParam === "string" ? partstatParam : null;

        attendees.push({
          email,
          name: cn,
          status: this.mapPartstat(partstat),
        });
      }
    }

    return attendees;
  }

  private mapPartstat(partstat: string | null): Attendee["status"] {
    if (!partstat) return "needsAction";
    const normalized = partstat.toLowerCase();
    if (normalized === "accepted") return "accepted";
    if (normalized === "declined") return "declined";
    if (normalized === "tentative") return "tentative";
    return "needsAction";
  }

  private parseRecurrence(vevent: ICAL.Component): string | null {
    const rrule = vevent.getFirstPropertyValue("rrule");
    if (!rrule) return null;
    return rrule.toString();
  }

  async createEvent(event: CreateEventInput): Promise<{ id: string }> {
    if (!this.client) {
      throw new Error("CalDAV client not connected");
    }

    const calendars = await this.client.fetchCalendars();
    if (!calendars.length) {
      throw new Error("No calendars found");
    }

    const primaryCalendar = calendars[0];
    const uid = `bee-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const vcalendar = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Bee PKM//Time Block//EN
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${this.formatICALDate(new Date())}
DTSTART:${this.formatICALDate(event.startTime)}
DTEND:${this.formatICALDate(event.endTime)}
SUMMARY:${this.escapeICALText(event.title)}
DESCRIPTION:${this.escapeICALText(event.description || "")}
${event.location ? `LOCATION:${this.escapeICALText(event.location)}` : ""}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

    await this.client.createCalendarObject({
      calendar: primaryCalendar,
      filename: `${uid}.ics`,
      iCalString: vcalendar,
    });

    return { id: uid };
  }

  async deleteEvent(externalId: string): Promise<void> {
    if (!this.client) {
      throw new Error("CalDAV client not connected");
    }

    const calendars = await this.client.fetchCalendars();
    if (!calendars.length) {
      throw new Error("No calendars found");
    }

    const primaryCalendar = calendars[0];

    await this.client.deleteCalendarObject({
      calendarObject: {
        url: `${primaryCalendar.url}${externalId}.ics`,
        etag: "",
      },
    });
  }

  private formatICALDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  }

  private escapeICALText(text: string): string {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  }

  async disconnect(): Promise<void> {
    this.client = null;
  }
}
