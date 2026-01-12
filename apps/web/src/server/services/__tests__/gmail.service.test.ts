import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Use vi.hoisted for proper mock hoisting
const { mocks, aiMocks } = vi.hoisted(() => ({
  mocks: {
    messagesList: vi.fn(),
    messagesGet: vi.fn(),
    usersGetProfile: vi.fn(),
  },
  aiMocks: {
    classifyItem: vi.fn(),
    getUserContext: vi.fn(),
  },
}));

// Mock the googleapis module
vi.mock("googleapis", () => {
  class MockOAuth2 {
    setCredentials = vi.fn();
  }

  return {
    google: {
      auth: {
        OAuth2: MockOAuth2,
      },
      gmail: () => ({
        users: {
          messages: {
            list: mocks.messagesList,
            get: mocks.messagesGet,
          },
          getProfile: mocks.usersGetProfile,
        },
      }),
    },
  };
});

// Mock prisma
vi.mock("@packages/db", () => ({
  prisma: {
    inboxItem: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    area: {
      findMany: vi.fn(),
    },
    project: {
      findMany: vi.fn(),
    },
  },
}));

// Mock AI classification service
vi.mock("../ai-classification.service", () => ({
  aiClassificationService: {
    classifyItem: aiMocks.classifyItem,
    getUserContext: aiMocks.getUserContext,
  },
}));

// Import after mocks are set up
import { GmailService } from "../gmail.service";

describe("GmailService", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default AI mock behavior
    aiMocks.classifyItem.mockResolvedValue({
      category: "action",
      confidence: 0.8,
      reasoning: "Email contains action items",
      extractedActions: [],
      tags: [],
    });
    aiMocks.getUserContext.mockResolvedValue({
      areas: ["Work"],
      projects: ["Project Alpha"],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create a service with access token", () => {
      const service = new GmailService("test-access-token");
      expect(service).toBeDefined();
    });

    it("should create a service with access and refresh tokens", () => {
      const service = new GmailService("test-access-token", "test-refresh-token");
      expect(service).toBeDefined();
    });
  });

  describe("fetchMessage", () => {
    const mockEmailResponse = {
      data: {
        id: "msg-123",
        threadId: "thread-456",
        snippet: "This is a test email snippet",
        internalDate: "1704067200000",
        labelIds: ["INBOX", "UNREAD"],
        payload: {
          headers: [
            { name: "From", value: "sender@example.com" },
            { name: "To", value: "recipient@example.com" },
            { name: "Subject", value: "Test Subject" },
          ],
          body: {
            data: Buffer.from("Hello, this is a test email body.").toString("base64"),
          },
        },
      },
    };

    it("should fetch and parse a plain text email", async () => {
      mocks.messagesGet.mockResolvedValue(mockEmailResponse);

      const service = new GmailService("test-token");
      const email = await service.fetchMessage("msg-123");

      expect(email.messageId).toBe("msg-123");
      expect(email.threadId).toBe("thread-456");
      expect(email.from).toBe("sender@example.com");
      expect(email.to).toBe("recipient@example.com");
      expect(email.subject).toBe("Test Subject");
      expect(email.body).toBe("Hello, this is a test email body.");
      expect(email.labels).toEqual(["INBOX", "UNREAD"]);
    });

    it("should handle multipart email with plain text", async () => {
      const multipartResponse = {
        data: {
          id: "msg-456",
          threadId: "thread-789",
          snippet: "Multipart email",
          internalDate: "1704067200000",
          labelIds: ["INBOX"],
          payload: {
            headers: [
              { name: "From", value: "sender@test.com" },
              { name: "To", value: "to@test.com" },
              { name: "Subject", value: "Multipart Subject" },
            ],
            mimeType: "multipart/alternative",
            parts: [
              {
                mimeType: "text/plain",
                body: {
                  data: Buffer.from("Plain text content").toString("base64"),
                },
              },
              {
                mimeType: "text/html",
                body: {
                  data: Buffer.from("<p>HTML content</p>").toString("base64"),
                },
              },
            ],
          },
        },
      };

      mocks.messagesGet.mockResolvedValue(multipartResponse);

      const service = new GmailService("test-token");
      const email = await service.fetchMessage("msg-456");

      expect(email.body).toBe("Plain text content");
    });

    it("should fall back to HTML and strip tags", async () => {
      const htmlOnlyResponse = {
        data: {
          id: "msg-789",
          threadId: "thread-101",
          snippet: "HTML only email",
          internalDate: "1704067200000",
          labelIds: ["INBOX"],
          payload: {
            headers: [
              { name: "From", value: "sender@test.com" },
              { name: "To", value: "to@test.com" },
              { name: "Subject", value: "HTML Subject" },
            ],
            mimeType: "multipart/alternative",
            parts: [
              {
                mimeType: "text/html",
                body: {
                  data: Buffer.from(
                    "<html><body><p>Hello</p><script>alert('x')</script><div>World</div></body></html>"
                  ).toString("base64"),
                },
              },
            ],
          },
        },
      };

      mocks.messagesGet.mockResolvedValue(htmlOnlyResponse);

      const service = new GmailService("test-token");
      const email = await service.fetchMessage("msg-789");

      expect(email.body).not.toContain("<");
      expect(email.body).not.toContain("script");
      expect(email.body).toContain("Hello");
      expect(email.body).toContain("World");
    });

    it("should extract attachments metadata", async () => {
      const emailWithAttachments = {
        data: {
          id: "msg-attach",
          threadId: "thread-attach",
          snippet: "Email with attachments",
          internalDate: "1704067200000",
          labelIds: ["INBOX"],
          payload: {
            headers: [
              { name: "From", value: "sender@test.com" },
              { name: "To", value: "to@test.com" },
              { name: "Subject", value: "With Attachments" },
            ],
            body: {
              data: Buffer.from("Email with attachments").toString("base64"),
            },
            parts: [
              {
                filename: "document.pdf",
                mimeType: "application/pdf",
                body: {
                  attachmentId: "attach-1",
                  size: 1024,
                },
              },
              {
                filename: "image.png",
                mimeType: "image/png",
                body: {
                  attachmentId: "attach-2",
                  size: 2048,
                },
              },
            ],
          },
        },
      };

      mocks.messagesGet.mockResolvedValue(emailWithAttachments);

      const service = new GmailService("test-token");
      const email = await service.fetchMessage("msg-attach");

      expect(email.attachments).toHaveLength(2);
      expect(email.attachments[0]).toEqual({
        filename: "document.pdf",
        mimeType: "application/pdf",
        size: 1024,
      });
    });

    it("should handle missing subject gracefully", async () => {
      const noSubjectResponse = {
        data: {
          id: "msg-no-subject",
          threadId: "thread-ns",
          internalDate: "1704067200000",
          labelIds: [],
          payload: {
            headers: [
              { name: "From", value: "sender@test.com" },
              { name: "To", value: "to@test.com" },
            ],
            body: { data: Buffer.from("Body").toString("base64") },
          },
        },
      };

      mocks.messagesGet.mockResolvedValue(noSubjectResponse);

      const service = new GmailService("test-token");
      const email = await service.fetchMessage("msg-no-subject");

      expect(email.subject).toBe("(no subject)");
    });
  });

  describe("syncUnreadToInbox", () => {
    beforeEach(async () => {
      const { prisma } = await import("@packages/db");

      (prisma.inboxItem.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.inboxItem.create as ReturnType<typeof vi.fn>).mockImplementation(
        async ({ data }) => ({
          id: "inbox-item-" + Date.now(),
          ...data,
          createdAt: new Date(),
        })
      );
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "user-123",
        settings: {},
      });
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "user-123",
      });
    });

    it("should sync unread emails successfully", async () => {
      mocks.messagesList.mockResolvedValue({
        data: {
          messages: [
            { id: "msg-1", threadId: "thread-1" },
            { id: "msg-2", threadId: "thread-2" },
          ],
        },
      });

      // The Gmail API passes an object with userId, id, and format
      mocks.messagesGet.mockImplementation(async (params: { id: string }) => ({
        data: {
          id: params.id,
          threadId: `thread-${params.id}`,
          snippet: `Snippet for ${params.id}`,
          internalDate: "1704067200000",
          labelIds: ["INBOX", "UNREAD"],
          payload: {
            headers: [
              { name: "From", value: `sender${params.id}@test.com` },
              { name: "To", value: "to@test.com" },
              { name: "Subject", value: `Subject ${params.id}` },
            ],
            body: {
              data: Buffer.from(`Body for ${params.id}`).toString("base64"),
            },
          },
        },
      }));

      const service = new GmailService("test-token");
      const result = await service.syncUnreadToInbox("user-123");

      expect(result.synced).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.messages).toHaveLength(2);
    });

    it("should skip already synced emails", async () => {
      const { prisma } = await import("@packages/db");

      mocks.messagesList.mockResolvedValue({
        data: {
          messages: [{ id: "msg-already-synced", threadId: "thread-1" }],
        },
      });

      // This message already exists
      (prisma.inboxItem.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "existing-item",
      });

      const service = new GmailService("test-token");
      const result = await service.syncUnreadToInbox("user-123");

      // All messages should be skipped since they exist
      expect(result.skipped).toBe(1);
      expect(result.synced).toBe(0);
    });

    it("should handle empty inbox", async () => {
      mocks.messagesList.mockResolvedValue({
        data: { messages: [] },
      });

      const service = new GmailService("test-token");
      const result = await service.syncUnreadToInbox("user-123");

      expect(result.synced).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
    });
  });

  describe("getProfile", () => {
    it("should return user profile", async () => {
      mocks.usersGetProfile.mockResolvedValue({
        data: {
          emailAddress: "user@example.com",
          messagesTotal: 1000,
        },
      });

      const service = new GmailService("test-token");
      const profile = await service.getProfile();

      expect(profile.email).toBe("user@example.com");
      expect(profile.messagesTotal).toBe(1000);
    });
  });

  describe("testConnection", () => {
    it("should return success when connection is valid", async () => {
      mocks.usersGetProfile.mockResolvedValue({
        data: {
          emailAddress: "user@example.com",
          messagesTotal: 100,
        },
      });

      const result = await GmailService.testConnection("test-token");

      expect(result.success).toBe(true);
      expect(result.latency).toBeDefined();
    });

    it("should return error when connection fails", async () => {
      mocks.usersGetProfile.mockRejectedValue(new Error("Invalid credentials"));

      const result = await GmailService.testConnection("invalid-token");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid credentials");
    });
  });
});
