import { Client, GraphError } from "@microsoft/microsoft-graph-client";
import { decrypt } from "@/lib/encryption";
import type { CalendarProvider, CalendarEventInput, CalendarAccountData, Attendee, CreateEventInput } from "./types";

// Token refresh callback type - will be injected by the calendar service
export type TokenRefreshCallback = (accountId: string) => Promise<{
  accessToken: string;
  expiresAt: Date;
} | null>;

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

interface MicrosoftEvent {
  id: string;
  subject?: string;
  body?: {
    content?: string;
    contentType?: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName?: string;
  };
  attendees?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
    status?: {
      response?: string;
    };
  }>;
  isAllDay?: boolean;
  showAs?: string;
  recurrence?: unknown;
}

export class MicrosoftCalendarClient implements CalendarProvider {
  private client: Client | null = null;
  private account: CalendarAccountData | null = null;
  private tokenRefreshCallback: TokenRefreshCallback | null = null;
  private currentAccessToken: string | null = null;

  /**
   * Set a callback for refreshing tokens when they expire
   */
  setTokenRefreshCallback(callback: TokenRefreshCallback): void {
    this.tokenRefreshCallback = callback;
  }

  async connect(account: CalendarAccountData): Promise<void> {
    if (!account.oauthAccessToken) {
      throw new Error("Microsoft OAuth access token is required");
    }

    this.account = account;
    this.currentAccessToken = await this.getValidToken();

    // Use a dynamic auth provider that can refresh tokens
    this.client = Client.init({
      authProvider: async (done) => {
        try {
          const token = await this.getValidToken();
          done(null, token);
        } catch (error) {
          done(error as Error, null);
        }
      },
    });
  }

  async fetchEvents(dateRange: { start: Date; end: Date }): Promise<CalendarEventInput[]> {
    if (!this.client) {
      throw new Error("Microsoft Graph client not connected");
    }

    const response = await this.executeWithRetry(async () =>
      this.client!
        .api("/me/calendarview")
        .query({
          startDateTime: dateRange.start.toISOString(),
          endDateTime: dateRange.end.toISOString(),
        })
        .select("id,subject,body,start,end,location,attendees,isAllDay,showAs,recurrence")
        .orderby("start/dateTime")
        .top(100)
        .get()
    );

    const events: CalendarEventInput[] = [];
    for (const event of response.value as MicrosoftEvent[]) {
      events.push(this.mapEvent(event));
    }

    return events;
  }

  /**
   * Execute an API call with retry logic for rate limiting (429) responses
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Check if it's a rate limit error (429)
        if (error instanceof GraphError && error.statusCode === 429) {
          // Get retry-after header or use exponential backoff
          const retryAfterHeader = error.headers?.get?.("Retry-After");
          const retryAfterSecs = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;
          const waitMs = retryAfterSecs
            ? retryAfterSecs * 1000
            : Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30 seconds

          if (attempt < maxRetries) {
            console.warn(
              `MS Graph rate limited, retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`
            );
            await this.sleep(waitMs);
            continue;
          }
        }

        // For non-429 errors or max retries exceeded, throw immediately
        throw error;
      }
    }

    throw lastError || new Error("Max retries exceeded");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private mapEvent(event: MicrosoftEvent): CalendarEventInput {
    return {
      externalId: event.id,
      title: event.subject || "Untitled",
      description: event.body?.content || null,
      location: event.location?.displayName || null,
      startTime: new Date(event.start.dateTime + "Z"),
      endTime: new Date(event.end.dateTime + "Z"),
      isAllDay: event.isAllDay || false,
      timezone: event.start.timeZone || "UTC",
      status: this.mapShowAs(event.showAs),
      attendees: this.mapAttendees(event.attendees),
      recurrence: event.recurrence ? JSON.stringify(event.recurrence) : null,
      rawData: event,
    };
  }

  private mapShowAs(showAs?: string): string {
    if (!showAs) return "confirmed";
    const normalized = showAs.toLowerCase();
    if (normalized === "tentative") return "tentative";
    if (normalized === "free") return "cancelled";
    return "confirmed";
  }

  private mapAttendees(
    attendees?: MicrosoftEvent["attendees"]
  ): Attendee[] | null {
    if (!attendees?.length) return null;

    return attendees.map((a) => ({
      email: a.emailAddress.address,
      name: a.emailAddress.name,
      status: this.mapResponseStatus(a.status?.response),
    }));
  }

  private mapResponseStatus(response?: string): Attendee["status"] {
    if (!response) return "needsAction";
    const normalized = response.toLowerCase();
    if (normalized === "accepted") return "accepted";
    if (normalized === "declined") return "declined";
    if (normalized === "tentativelyaccepted" || normalized === "tentative") return "tentative";
    return "needsAction";
  }

  private async getValidToken(): Promise<string> {
    if (!this.account?.oauthAccessToken) {
      throw new Error("No access token available");
    }

    const now = new Date();
    const expiresAt = this.account.oauthExpiresAt ? new Date(this.account.oauthExpiresAt) : null;

    // Check if token is expired or about to expire
    const isExpiredOrExpiring = expiresAt &&
      (expiresAt.getTime() - TOKEN_EXPIRY_BUFFER_MS) < now.getTime();

    if (isExpiredOrExpiring) {
      // Try to refresh the token
      if (this.tokenRefreshCallback && this.account.id) {
        try {
          const refreshed = await this.tokenRefreshCallback(this.account.id);
          if (refreshed) {
            // Update local state with new token
            this.account.oauthAccessToken = refreshed.accessToken;
            this.account.oauthExpiresAt = refreshed.expiresAt;
            this.currentAccessToken = decryptToken(refreshed.accessToken);
            return this.currentAccessToken;
          }
        } catch (error) {
          console.error("Failed to refresh Microsoft OAuth token:", error);
        }
      }

      // If we can't refresh, throw an error
      throw new Error("Token expired and refresh failed - re-authentication required");
    }

    // Decrypt and return the token
    return decryptToken(this.account.oauthAccessToken);
  }

  async createEvent(event: CreateEventInput): Promise<{ id: string }> {
    if (!this.client) {
      throw new Error("Microsoft Graph client not connected");
    }

    const response = await this.executeWithRetry(async () =>
      this.client!
        .api("/me/calendar/events")
        .post({
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
          location: event.location ? { displayName: event.location } : undefined,
          showAs: "busy",
        })
    );

    return { id: response.id };
  }

  async deleteEvent(externalId: string): Promise<void> {
    if (!this.client) {
      throw new Error("Microsoft Graph client not connected");
    }

    await this.executeWithRetry(async () =>
      this.client!.api(`/me/calendar/events/${externalId}`).delete()
    );
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.account = null;
  }
}
