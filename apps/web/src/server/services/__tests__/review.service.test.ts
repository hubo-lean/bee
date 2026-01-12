import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("@packages/db", () => ({
  prisma: {
    inboxItem: {
      update: vi.fn(),
      findMany: vi.fn(),
    },
    classificationAudit: {
      updateMany: vi.fn(),
    },
    reviewSession: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  Prisma: {
    JsonNull: "JsonNull",
    AnyNull: "AnyNull",
  },
}));

import { prisma } from "@packages/db";
import {
  handleSwipe,
  undoSwipe,
  getOrCreateSession,
} from "../review.service";

interface MockInboxItem {
  id: string;
  userId: string;
  type: string;
  content: string;
  mediaUrl: string | null;
  source: string;
  status: string;
  aiClassification: Record<string, unknown> | null;
  extractedActions: Record<string, unknown>[];
  tags: Record<string, unknown>[];
  userFeedback: Record<string, unknown> | null;
  createdAt: Date;
  reviewedAt: Date | null;
  archivedAt: Date | null;
}

const mockItem: MockInboxItem = {
  id: "item-123",
  userId: "user-456",
  type: "manual",
  content: "Test item content",
  mediaUrl: null,
  source: "manual",
  status: "pending",
  aiClassification: { category: "action", confidence: 0.85 },
  extractedActions: [],
  tags: [],
  userFeedback: null,
  createdAt: new Date(),
  reviewedAt: null,
  archivedAt: null,
};

describe("reviewService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleSwipe", () => {
    it("should handle agree (right) swipe correctly", async () => {
      vi.mocked(prisma.inboxItem.update).mockResolvedValue({
        ...mockItem,
        status: "reviewed",
      } as never);
      vi.mocked(prisma.classificationAudit.updateMany).mockResolvedValue({
        count: 1,
      });

      const result = await handleSwipe("right", mockItem as never, "session-789");

      expect(result.action).toBe("agree");
      expect(result.undoable).toBe(true);
      expect(result.message).toContain("action");
      expect(prisma.inboxItem.update).toHaveBeenCalledWith({
        where: { id: mockItem.id },
        data: expect.objectContaining({
          status: "reviewed",
          reviewedAt: expect.any(Date),
        }),
      });
    });

    it("should handle disagree (left) swipe correctly", async () => {
      vi.mocked(prisma.inboxItem.update).mockResolvedValue(mockItem as never);

      const result = await handleSwipe("left", mockItem as never, "session-789");

      expect(result.action).toBe("disagree");
      expect(result.undoable).toBe(true);
      expect(result.openModal).toBe("correction");
      expect(prisma.inboxItem.update).toHaveBeenCalledWith({
        where: { id: mockItem.id },
        data: expect.objectContaining({
          userFeedback: expect.objectContaining({
            agreed: false,
            needsCorrection: true,
          }),
        }),
      });
    });

    it("should handle urgent (up) swipe correctly", async () => {
      vi.mocked(prisma.inboxItem.update).mockResolvedValue({
        ...mockItem,
        status: "reviewed",
      } as never);
      vi.mocked(prisma.classificationAudit.updateMany).mockResolvedValue({
        count: 1,
      });

      const result = await handleSwipe("up", mockItem as never, "session-789");

      expect(result.action).toBe("urgent");
      expect(result.undoable).toBe(true);
      expect(result.message).toBe("Marked as urgent priority");
      expect(prisma.inboxItem.update).toHaveBeenCalledWith({
        where: { id: mockItem.id },
        data: expect.objectContaining({
          status: "reviewed",
          extractedActions: expect.arrayContaining([
            expect.objectContaining({
              priority: "urgent",
            }),
          ]),
        }),
      });
    });

    it("should handle hide (down) swipe correctly", async () => {
      vi.mocked(prisma.inboxItem.update).mockResolvedValue({
        ...mockItem,
        status: "archived",
      } as never);
      vi.mocked(prisma.classificationAudit.updateMany).mockResolvedValue({
        count: 1,
      });

      const result = await handleSwipe("down", mockItem as never, "session-789");

      expect(result.action).toBe("hide");
      expect(result.undoable).toBe(true);
      expect(result.message).toBe("Item archived");
      expect(prisma.inboxItem.update).toHaveBeenCalledWith({
        where: { id: mockItem.id },
        data: expect.objectContaining({
          status: "archived",
          archivedAt: expect.any(Date),
        }),
      });
    });

    it("should return previous state for undo", async () => {
      vi.mocked(prisma.inboxItem.update).mockResolvedValue(mockItem as never);

      const result = await handleSwipe("right", mockItem as never, "session-789");

      expect(result.previousState).toEqual({
        status: mockItem.status,
        extractedActions: mockItem.extractedActions,
      });
    });
  });

  describe("undoSwipe", () => {
    it("should restore previous state", async () => {
      vi.mocked(prisma.inboxItem.update).mockResolvedValue(mockItem as never);
      vi.mocked(prisma.classificationAudit.updateMany).mockResolvedValue({
        count: 1,
      });

      const previousState = {
        status: "pending",
        extractedActions: [],
      };

      const result = await undoSwipe(mockItem.id, previousState);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Action undone");
      expect(prisma.inboxItem.update).toHaveBeenCalledWith({
        where: { id: mockItem.id },
        data: expect.objectContaining({
          status: previousState.status,
          userFeedback: "JsonNull",
        }),
      });
    });
  });

  describe("getOrCreateSession", () => {
    it("should return existing active session", async () => {
      const existingSession = {
        id: "session-123",
        userId: "user-456",
        itemIds: ["item-1", "item-2"],
        currentIndex: 0,
        actions: [],
        startedAt: new Date(),
        lastActivityAt: new Date(),
        completedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        stats: null,
        type: "daily",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.reviewSession.findFirst).mockResolvedValue(
        existingSession as never
      );
      vi.mocked(prisma.reviewSession.update).mockResolvedValue(existingSession as never);

      const result = await getOrCreateSession("user-456");

      expect(result.id).toBe(existingSession.id);
      expect(prisma.reviewSession.update).toHaveBeenCalledWith({
        where: { id: existingSession.id },
        data: { lastActivityAt: expect.any(Date) },
      });
    });

    it("should create new session when none exists", async () => {
      const newSession = {
        id: "new-session",
        userId: "user-456",
        itemIds: ["item-1"],
        currentIndex: 0,
        actions: [],
        startedAt: new Date(),
        lastActivityAt: new Date(),
        completedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        stats: {
          agreed: 0,
          disagreed: 0,
          urgent: 0,
          hidden: 0,
          totalTimeMs: 0,
        },
        type: "daily",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.reviewSession.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.reviewSession.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.inboxItem.findMany).mockResolvedValue([
        { id: "item-1" },
      ] as never);
      vi.mocked(prisma.reviewSession.create).mockResolvedValue(newSession as never);

      const result = await getOrCreateSession("user-456");

      expect(result.id).toBe(newSession.id);
      expect(prisma.reviewSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-456",
          itemIds: ["item-1"],
          currentIndex: 0,
        }),
      });
    });

    it("should force create new session when forceNew is true", async () => {
      const existingSession = {
        id: "old-session",
        userId: "user-456",
        itemIds: [],
        currentIndex: 0,
        actions: [],
        startedAt: new Date(),
        lastActivityAt: new Date(),
        completedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        stats: null,
        type: "daily",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newSession = {
        id: "new-session",
        userId: "user-456",
        itemIds: [],
        currentIndex: 0,
        actions: [],
        startedAt: new Date(),
        lastActivityAt: new Date(),
        completedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        stats: null,
        type: "daily",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.reviewSession.findFirst).mockResolvedValue(
        existingSession as never
      );
      vi.mocked(prisma.reviewSession.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.inboxItem.findMany).mockResolvedValue([] as never);
      vi.mocked(prisma.reviewSession.create).mockResolvedValue(newSession as never);

      const result = await getOrCreateSession("user-456", true);

      expect(result.id).toBe(newSession.id);
      expect(prisma.reviewSession.create).toHaveBeenCalled();
    });
  });
});
