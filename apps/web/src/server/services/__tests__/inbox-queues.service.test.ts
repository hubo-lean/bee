import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("@packages/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    inboxItem: {
      updateMany: vi.fn(),
    },
    note: {
      create: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "@packages/db";
import {
  getNeedsReviewQueue,
  getDisagreementsQueue,
  getQueueCounts,
  archiveQueueItems,
} from "../inbox-queues.service";

const mockItems = [
  {
    id: "item-1",
    userId: "user-123",
    type: "manual",
    content: "Low confidence item",
    mediaUrl: null,
    source: "manual",
    status: "pending",
    aiClassification: { category: "action", confidence: 0.4 },
    extractedActions: [],
    tags: [],
    userFeedback: null,
    createdAt: new Date("2024-01-01"),
    reviewedAt: null,
    archivedAt: null,
    autoArchiveWarning: null,
    autoArchiveDate: null,
  },
  {
    id: "item-2",
    userId: "user-123",
    type: "manual",
    content: "Deferred item",
    mediaUrl: null,
    source: "manual",
    status: "pending",
    aiClassification: { category: "reference", confidence: 0.9 },
    extractedActions: [],
    tags: [],
    userFeedback: { deferredToWeekly: true },
    createdAt: new Date("2024-01-02"),
    reviewedAt: null,
    archivedAt: null,
    autoArchiveWarning: null,
    autoArchiveDate: null,
  },
];

describe("inbox-queues.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getNeedsReviewQueue", () => {
    it("should use raw SQL to filter by confidence threshold", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-123",
        settings: { confidenceThreshold: 0.6 },
      } as never);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([mockItems[0]] as never);

      const result = await getNeedsReviewQueue("user-123");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("item-1");
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it("should use default threshold when user settings not set", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-123",
        settings: {},
      } as never);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([mockItems[0]] as never);

      const result = await getNeedsReviewQueue("user-123");

      expect(result).toHaveLength(1);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it("should use default threshold when user not found", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);

      const result = await getNeedsReviewQueue("user-123");

      expect(result).toHaveLength(0);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe("getDisagreementsQueue", () => {
    it("should use raw SQL to filter by deferredToWeekly flag", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([mockItems[1]] as never);

      const result = await getDisagreementsQueue("user-123");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("item-2");
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it("should return empty array when no deferred items", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);

      const result = await getDisagreementsQueue("user-123");

      expect(result).toHaveLength(0);
    });
  });

  describe("getQueueCounts", () => {
    it("should return combined counts from both queues", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-123",
        settings: {},
      } as never);
      // First call for needsReview, second for disagreements
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([mockItems[0]] as never)
        .mockResolvedValueOnce([mockItems[1]] as never);

      const result = await getQueueCounts("user-123");

      expect(result.needsReview).toBe(1);
      expect(result.disagreements).toBe(1);
      expect(result.mandatory).toBe(2);
      expect(result.isComplete).toBe(false);
    });

    it("should return isComplete true when no items", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-123",
        settings: {},
      } as never);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);

      const result = await getQueueCounts("user-123");

      expect(result.mandatory).toBe(0);
      expect(result.isComplete).toBe(true);
    });
  });

  describe("archiveQueueItems", () => {
    it("should archive all items in needsReview queue", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-123",
        settings: {},
      } as never);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([mockItems[0]] as never);
      vi.mocked(prisma.inboxItem.updateMany).mockResolvedValue({ count: 1 });

      const result = await archiveQueueItems("user-123", "needsReview");

      expect(result.archived).toBe(1);
      expect(prisma.inboxItem.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ["item-1"] },
          userId: "user-123",
        },
        data: {
          status: "archived",
          archivedAt: expect.any(Date),
        },
      });
    });

    it("should return 0 when queue is empty", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-123",
        settings: {},
      } as never);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);

      const result = await archiveQueueItems("user-123", "needsReview");

      expect(result.archived).toBe(0);
      expect(prisma.inboxItem.updateMany).not.toHaveBeenCalled();
    });
  });
});
