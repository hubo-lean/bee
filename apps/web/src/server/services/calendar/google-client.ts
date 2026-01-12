import { google, calendar_v3 } from "googleapis";
import { decrypt } from "@/lib/encryption";
import type {
  CalendarProvider,
  CalendarEventInput,
  CalendarAccountData,
  Attendee,
  CreateEventInput,
} from "./types";

/**
 * Safely decrypt OAuth tokens if encrypted
 */
function decryptToken(token: string): string {
  if (token.includes(":") && token.split(":").length === 3) {
    try {
      return decrypt(token);
    } catch {
      console.warn("OAuth token decryption failed, using raw value");
      return token;
    }
  }
  return token;
}

// Buffer time before expiry to trigger refresh (5 minutes)
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

interface GoogleEvent {
  id?: string | null;
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  start?: {
    dateTime?: string | null;
    date?: string | null;
    timeZone?: string | null;
  } | null;
  end?: {
    dateTime?: string | null;
    date?: string | null;
    timeZone?: string | null;
  } | null;
  attendees?: Array<{
    email?: string | null;
    displayName?: string | null;
    responseStatus?: string | null;
  }> | null;
  recurrence?: string[] | null;
  status?: string | null;
}

/**
 * Google Calendar Client
 *
 * Uses Google Calendar API with OAuth2 for authentication.
 * Supports fetching events, creating events, and deleting events.
 */
export class GoogleCalendarClient implements CalendarProvider {
  private calendar: calendar_v3.Calendar | null = null;
  private account: CalendarAccountData | null = null;
  private oauth2Client: ReturnType<typeof google.auth.OAuth2.prototype> | null = null;

  async connect(account: CalendarAccountData): Promise<void> {
    if (!account.oauthAccessToken) {
      throw new Error("Google OAuth access token is required");
    }

    this.account = account;

    // Create OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    // Set credentials
    const accessToken = decryptToken(account.oauthAccessToken);
    const refreshToken = account.oauthRefreshToken
      ? decryptToken(account.oauthRefreshToken)
      : undefined;

    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: account.oauthExpiresAt?.getTime(),
    });

    // Check if token needs refresh
    await this.ensureValidToken();

    // Create calendar client
    this.calendar = google.calendar({ version: "v3", auth: this.oauth2Client });
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.oauth2Client || !this.account) {
      throw new Error("Not connected");
    }

    const now = Date.now();
    const expiresAt = this.account.oauthExpiresAt?.getTime();

    // Check if token is expired or about to expire
    if (expiresAt && expiresAt - TOKEN_EXPIRY_BUFFER_MS < now) {
      if (this.account.oauthRefreshToken) {
        try {
          // Attempt to refresh the token
          const { credentials } = await this.oauth2Client.refreshAccessToken();
          this.oauth2Client.setCredentials(credentials);

          // Note: In a full implementation, we would update the database with the new token
          // For now, we just use it in memory for this request
          console.log("[GoogleCalendar] Token refreshed successfully");
        } catch (error) {
          console.error("[GoogleCalendar] Token refresh failed:", error);
          throw new Error("Token expired and refresh failed - re-authentication required");
        }
      } else {
        throw new Error("Token expired and no refresh token available");
      }
    }
  }

  async fetchEvents(dateRange: { start: Date; end: Date }): Promise<CalendarEventInput[]> {
    if (!this.calendar) {
      throw new Error("Google Calendar client not connected");
    }

    const events: CalendarEventInput[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.calendar.events.list({
        calendarId: "primary",
        timeMin: dateRange.start.toISOString(),
        timeMax: dateRange.end.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 100,
        pageToken,
      });

      const items = response.data.items || [];

      for (const event of items) {
        const mapped = this.mapEvent(event as GoogleEvent);
        if (mapped) {
          events.push(mapped);
        }
      }

      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    return events;
  }

  private mapEvent(event: GoogleEvent): CalendarEventInput | null {
    if (!event.id || (!event.start?.dateTime && !event.start?.date)) {
      return null;
    }

    const isAllDay = !event.start?.dateTime;
    const startTime = isAllDay
      ? new Date(event.start?.date || "")
      : new Date(event.start?.dateTime || "");
    const endTime = isAllDay
      ? new Date(event.end?.date || "")
      : new Date(event.end?.dateTime || "");

    return {
      externalId: event.id,
      title: event.summary || "Untitled",
      description: event.description || null,
      location: event.location || null,
      startTime,
      endTime,
      isAllDay,
      timezone: event.start?.timeZone || "UTC",
      status: this.mapStatus(event.status),
      attendees: this.mapAttendees(event.attendees),
      recurrence: event.recurrence?.join(";") || null,
      rawData: event,
    };
  }

  private mapStatus(status?: string | null): string {
    if (!status) return "confirmed";
    switch (status.toLowerCase()) {
      case "tentative":
        return "tentative";
      case "cancelled":
        return "cancelled";
      default:
        return "confirmed";
    }
  }

  private mapAttendees(
    attendees?: GoogleEvent["attendees"]
  ): Attendee[] | null {
    if (!attendees?.length) return null;

    return attendees
      .filter((a) => a.email)
      .map((a) => ({
        email: a.email!,
        name: a.displayName || undefined,
        status: this.mapResponseStatus(a.responseStatus),
      }));
  }

  private mapResponseStatus(response?: string | null): Attendee["status"] {
    if (!response) return "needsAction";
    switch (response.toLowerCase()) {
      case "accepted":
        return "accepted";
      case "declined":
        return "declined";
      case "tentative":
        return "tentative";
      default:
        return "needsAction";
    }
  }

  async createEvent(event: CreateEventInput): Promise<{ id: string }> {
    if (!this.calendar) {
      throw new Error("Google Calendar client not connected");
    }

    const response = await this.calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: event.title,
        description: event.description || "",
        location: event.location || "",
        start: {
          dateTime: event.startTime.toISOString(),
          timeZone: "UTC",
        },
        end: {
          dateTime: event.endTime.toISOString(),
          timeZone: "UTC",
        },
      },
    });

    if (!response.data.id) {
      throw new Error("Failed to create event - no ID returned");
    }

    return { id: response.data.id };
  }

  async deleteEvent(externalId: string): Promise<void> {
    if (!this.calendar) {
      throw new Error("Google Calendar client not connected");
    }

    await this.calendar.events.delete({
      calendarId: "primary",
      eventId: externalId,
    });
  }

  async disconnect(): Promise<void> {
    this.calendar = null;
    this.oauth2Client = null;
    this.account = null;
  }
}
