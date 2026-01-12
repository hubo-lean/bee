import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Use vi.hoisted for proper mock hoisting
const { mocks } = vi.hoisted(() => ({
  mocks: {
    eventsList: vi.fn(),
    eventsInsert: vi.fn(),
    eventsDelete: vi.fn(),
    refreshAccessToken: vi.fn(),
    setCredentials: vi.fn(),
  },
}));

// Mock the googleapis module
vi.mock("googleapis", () => {
  class MockOAuth2 {
    setCredentials = mocks.setCredentials;
    refreshAccessToken = mocks.refreshAccessToken;
  }

  return {
    google: {
      auth: {
        OAuth2: MockOAuth2,
      },
      calendar: () => ({
        events: {
          list: mocks.eventsList,
          insert: mocks.eventsInsert,
          delete: mocks.eventsDelete,
        },
      }),
    },
  };
});

// Mock encryption
vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn((token: string) => {
    // If it looks encrypted (has colons), "decrypt" it
    if (token.includes(":")) {
      return "decrypted-token";
    }
    return token;
  }),
}));

// Import after mocks are set up
import { GoogleCalendarClient } from "../calendar/google-client";

describe("GoogleCalendarClient", () => {
  let client: GoogleCalendarClient;

  const mockAccount = {
    id: "account-123",
    userId: "user-123",
    provider: "google_oauth",
    oauthAccessToken: "test-access-token",
    oauthRefreshToken: "test-refresh-token",
    oauthExpiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    calendarUrl: null,
    caldavUsername: null,
    caldavPassword: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GoogleCalendarClient();

    // Default mock implementations
    mocks.refreshAccessToken.mockResolvedValue({
      credentials: { access_token: "new-access-token" },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("connect", () => {
    it("should connect with valid OAuth token", async () => {
      await client.connect(mockAccount);

      expect(mocks.setCredentials).toHaveBeenCalledWith({
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        expiry_date: mockAccount.oauthExpiresAt.getTime(),
      });
    });

    it("should throw error if no access token", async () => {
      const accountWithoutToken = { ...mockAccount, oauthAccessToken: null };

      await expect(client.connect(accountWithoutToken)).rejects.toThrow(
        "Google OAuth access token is required"
      );
    });

    it("should decrypt encrypted tokens", async () => {
      const encryptedAccount = {
        ...mockAccount,
        oauthAccessToken: "iv:tag:encrypted",
        oauthRefreshToken: "iv:tag:encrypted-refresh",
      };

      await client.connect(encryptedAccount);

      expect(mocks.setCredentials).toHaveBeenCalledWith({
        access_token: "decrypted-token",
        refresh_token: "decrypted-token",
        expiry_date: mockAccount.oauthExpiresAt.getTime(),
      });
    });

    it("should refresh expired token if refresh token available", async () => {
      const expiredAccount = {
        ...mockAccount,
        oauthExpiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      };

      await client.connect(expiredAccount);

      expect(mocks.refreshAccessToken).toHaveBeenCalled();
    });

    it("should throw error if token expired and no refresh token", async () => {
      const expiredAccountNoRefresh = {
        ...mockAccount,
        oauthExpiresAt: new Date(Date.now() - 3600000),
        oauthRefreshToken: null,
      };

      await expect(client.connect(expiredAccountNoRefresh)).rejects.toThrow(
        "Token expired and no refresh token available"
      );
    });
  });

  describe("fetchEvents", () => {
    beforeEach(async () => {
      await client.connect(mockAccount);
    });

    it("should fetch events for date range", async () => {
      const mockEvents = [
        {
          id: "event-1",
          summary: "Test Meeting",
          description: "A test meeting",
          location: "Conference Room A",
          start: { dateTime: "2026-01-15T10:00:00Z", timeZone: "UTC" },
          end: { dateTime: "2026-01-15T11:00:00Z", timeZone: "UTC" },
          attendees: [
            { email: "user@example.com", displayName: "User", responseStatus: "accepted" },
          ],
          status: "confirmed",
        },
      ];

      mocks.eventsList.mockResolvedValue({
        data: { items: mockEvents, nextPageToken: null },
      });

      const dateRange = {
        start: new Date("2026-01-15"),
        end: new Date("2026-01-16"),
      };

      const events = await client.fetchEvents(dateRange);

      expect(events).toHaveLength(1);
      expect(events[0].externalId).toBe("event-1");
      expect(events[0].title).toBe("Test Meeting");
      expect(events[0].location).toBe("Conference Room A");
      expect(events[0].attendees).toHaveLength(1);
      expect(events[0].attendees![0].status).toBe("accepted");
    });

    it("should handle all-day events", async () => {
      const mockEvents = [
        {
          id: "event-2",
          summary: "All Day Event",
          start: { date: "2026-01-15" },
          end: { date: "2026-01-16" },
          status: "confirmed",
        },
      ];

      mocks.eventsList.mockResolvedValue({
        data: { items: mockEvents, nextPageToken: null },
      });

      const events = await client.fetchEvents({
        start: new Date("2026-01-15"),
        end: new Date("2026-01-16"),
      });

      expect(events).toHaveLength(1);
      expect(events[0].isAllDay).toBe(true);
    });

    it("should handle pagination", async () => {
      // First page
      mocks.eventsList.mockResolvedValueOnce({
        data: {
          items: [{ id: "event-1", summary: "Event 1", start: { dateTime: "2026-01-15T10:00:00Z" }, end: { dateTime: "2026-01-15T11:00:00Z" } }],
          nextPageToken: "page2",
        },
      });
      // Second page
      mocks.eventsList.mockResolvedValueOnce({
        data: {
          items: [{ id: "event-2", summary: "Event 2", start: { dateTime: "2026-01-15T12:00:00Z" }, end: { dateTime: "2026-01-15T13:00:00Z" } }],
          nextPageToken: null,
        },
      });

      const events = await client.fetchEvents({
        start: new Date("2026-01-15"),
        end: new Date("2026-01-16"),
      });

      expect(events).toHaveLength(2);
      expect(mocks.eventsList).toHaveBeenCalledTimes(2);
    });

    it("should skip events without ID or start time", async () => {
      const mockEvents = [
        { id: null, summary: "No ID Event", start: { dateTime: "2026-01-15T10:00:00Z" }, end: { dateTime: "2026-01-15T11:00:00Z" } },
        { id: "event-1", summary: "Valid Event", start: { dateTime: "2026-01-15T10:00:00Z" }, end: { dateTime: "2026-01-15T11:00:00Z" } },
      ];

      mocks.eventsList.mockResolvedValue({
        data: { items: mockEvents, nextPageToken: null },
      });

      const events = await client.fetchEvents({
        start: new Date("2026-01-15"),
        end: new Date("2026-01-16"),
      });

      expect(events).toHaveLength(1);
      expect(events[0].title).toBe("Valid Event");
    });

    it("should map attendee response statuses correctly", async () => {
      const mockEvents = [
        {
          id: "event-1",
          summary: "Meeting",
          start: { dateTime: "2026-01-15T10:00:00Z" },
          end: { dateTime: "2026-01-15T11:00:00Z" },
          attendees: [
            { email: "a@test.com", responseStatus: "accepted" },
            { email: "b@test.com", responseStatus: "declined" },
            { email: "c@test.com", responseStatus: "tentative" },
            { email: "d@test.com", responseStatus: "needsAction" },
            { email: "e@test.com", responseStatus: null },
          ],
        },
      ];

      mocks.eventsList.mockResolvedValue({
        data: { items: mockEvents, nextPageToken: null },
      });

      const events = await client.fetchEvents({
        start: new Date("2026-01-15"),
        end: new Date("2026-01-16"),
      });

      const attendees = events[0].attendees!;
      expect(attendees[0].status).toBe("accepted");
      expect(attendees[1].status).toBe("declined");
      expect(attendees[2].status).toBe("tentative");
      expect(attendees[3].status).toBe("needsAction");
      expect(attendees[4].status).toBe("needsAction");
    });
  });

  describe("createEvent", () => {
    beforeEach(async () => {
      await client.connect(mockAccount);
    });

    it("should create event and return ID", async () => {
      mocks.eventsInsert.mockResolvedValue({
        data: { id: "new-event-123" },
      });

      const result = await client.createEvent({
        title: "New Meeting",
        description: "A new meeting",
        startTime: new Date("2026-01-15T10:00:00Z"),
        endTime: new Date("2026-01-15T11:00:00Z"),
        location: "Room B",
      });

      expect(result.id).toBe("new-event-123");
      expect(mocks.eventsInsert).toHaveBeenCalledWith({
        calendarId: "primary",
        requestBody: expect.objectContaining({
          summary: "New Meeting",
          description: "A new meeting",
          location: "Room B",
        }),
      });
    });

    it("should throw error if no ID returned", async () => {
      mocks.eventsInsert.mockResolvedValue({
        data: { id: null },
      });

      await expect(
        client.createEvent({
          title: "New Meeting",
          startTime: new Date("2026-01-15T10:00:00Z"),
          endTime: new Date("2026-01-15T11:00:00Z"),
        })
      ).rejects.toThrow("Failed to create event - no ID returned");
    });
  });

  describe("deleteEvent", () => {
    beforeEach(async () => {
      await client.connect(mockAccount);
    });

    it("should delete event by external ID", async () => {
      mocks.eventsDelete.mockResolvedValue({});

      await client.deleteEvent("event-123");

      expect(mocks.eventsDelete).toHaveBeenCalledWith({
        calendarId: "primary",
        eventId: "event-123",
      });
    });
  });

  describe("disconnect", () => {
    it("should clear client state", async () => {
      await client.connect(mockAccount);
      await client.disconnect();

      // After disconnect, fetching events should fail
      await expect(
        client.fetchEvents({ start: new Date(), end: new Date() })
      ).rejects.toThrow("Google Calendar client not connected");
    });
  });
});
