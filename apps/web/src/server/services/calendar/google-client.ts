/* eslint-disable @typescript-eslint/no-unused-vars */
import type { CalendarProvider, CalendarEventInput, CalendarAccountData, CreateEventInput } from "./types";

/**
 * Google Calendar Client - Placeholder for future implementation
 *
 * This client will be implemented in a future story to support Google Calendar
 * via Google Calendar API (OAuth2).
 *
 * TODO: Implementation requirements:
 * 1. Add googleapis package: pnpm add googleapis
 * 2. Set up Google OAuth2 credentials in Google Cloud Console
 * 3. Implement OAuth flow for token acquisition
 * 4. Implement event CRUD operations
 *
 * For now, this throws an error to indicate the feature is not yet available.
 */
export class GoogleCalendarClient implements CalendarProvider {
  async connect(account: CalendarAccountData): Promise<void> {
    throw new Error(
      "Google Calendar integration is not yet implemented. " +
        "Please use Microsoft Calendar or CalDAV provider instead."
    );
  }

  async fetchEvents(dateRange: { start: Date; end: Date }): Promise<CalendarEventInput[]> {
    throw new Error("Google Calendar integration is not yet implemented.");
  }

  async createEvent(event: CreateEventInput): Promise<{ id: string }> {
    throw new Error("Google Calendar integration is not yet implemented.");
  }

  async deleteEvent(externalId: string): Promise<void> {
    throw new Error("Google Calendar integration is not yet implemented.");
  }

  async disconnect(): Promise<void> {
    // No-op for placeholder
  }
}
