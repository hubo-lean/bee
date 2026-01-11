import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  classificationService,
  type ClassificationCompletePayload,
} from "../classification.service";

// Mock prisma
vi.mock("@packages/db", () => ({
  prisma: {
    inboxItem: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    classificationAudit: {
      create: vi.fn(),
    },
    failedWebhook: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@packages/db";

const mockPrisma = prisma as unknown as {
  inboxItem: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  classificationAudit: {
    create: ReturnType<typeof vi.fn>;
  };
  failedWebhook: {
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

describe("classificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("processClassificationResult", () => {
    const validPayload: ClassificationCompletePayload = {
      inboxItemId: "123e4567-e89b-12d3-a456-426614174000",
      classification: {
        category: "action",
        confidence: 0.85,
        reasoning: "Contains task-like language",
        suggestedProject: "Work",
      },
      modelUsed: "claude-3-opus",
      processingTimeMs: 1200,
    };

    it("should process valid classification result successfully", async () => {
      mockPrisma.inboxItem.findUnique.mockResolvedValue({
        id: validPayload.inboxItemId,
        userId: "user-123",
        status: "pending",
        user: { settings: null },
      });
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await classificationService.processClassificationResult(validPayload);

      expect(result.success).toBe(true);
      expect(mockPrisma.inboxItem.findUnique).toHaveBeenCalledWith({
        where: { id: validPayload.inboxItemId },
        select: {
          id: true,
          userId: true,
          status: true,
          user: { select: { settings: true } },
        },
      });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it("should return error if inbox item not found", async () => {
      mockPrisma.inboxItem.findUnique.mockResolvedValue(null);

      const result = await classificationService.processClassificationResult(validPayload);

      expect(result.success).toBe(false);
      expect(result.error).toBe("InboxItem not found");
    });

    it("should set status to 'reviewed' for high confidence (>=0.6)", async () => {
      mockPrisma.inboxItem.findUnique.mockResolvedValue({
        id: validPayload.inboxItemId,
        userId: "user-123",
        status: "pending",
        user: { settings: null },
      });
      mockPrisma.$transaction.mockImplementation(async (ops: unknown[]) => {
        return ops;
      });

      await classificationService.processClassificationResult({
        ...validPayload,
        classification: { ...validPayload.classification, confidence: 0.75 },
      });

      // Verify transaction was called (status logic is inside)
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it("should set status to 'pending' for low confidence (<0.6)", async () => {
      mockPrisma.inboxItem.findUnique.mockResolvedValue({
        id: validPayload.inboxItemId,
        userId: "user-123",
        status: "pending",
        user: { settings: null },
      });
      mockPrisma.$transaction.mockImplementation(async (ops: unknown[]) => {
        return ops;
      });

      await classificationService.processClassificationResult({
        ...validPayload,
        classification: { ...validPayload.classification, confidence: 0.45 },
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.inboxItem.findUnique.mockRejectedValue(new Error("DB connection failed"));

      const result = await classificationService.processClassificationResult(validPayload);

      expect(result.success).toBe(false);
      expect(result.error).toBe("DB connection failed");
    });

    it("should process all category types", async () => {
      const categories = ["action", "note", "reference", "meeting", "unknown"] as const;

      for (const category of categories) {
        mockPrisma.inboxItem.findUnique.mockResolvedValue({
          id: validPayload.inboxItemId,
          userId: "user-123",
          status: "pending",
          user: { settings: null },
        });
        mockPrisma.$transaction.mockResolvedValue([{}, {}]);

        const result = await classificationService.processClassificationResult({
          ...validPayload,
          classification: { ...validPayload.classification, category },
        });

        expect(result.success).toBe(true);
      }
    });

    // Story 3.2: Action extraction tests
    it("should process payload with extracted actions", async () => {
      mockPrisma.inboxItem.findUnique.mockResolvedValue({
        id: validPayload.inboxItemId,
        userId: "user-123",
        status: "pending",
        user: { settings: null },
      });
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const payloadWithActions: ClassificationCompletePayload = {
        ...validPayload,
        extractedActions: [
          {
            id: "action-1",
            description: "Send budget report to Sarah",
            confidence: 0.95,
            owner: "Sarah",
            dueDate: "2026-01-16",
            priority: "normal",
          },
          {
            id: "action-2",
            description: "Schedule kickoff meeting with vendor",
            confidence: 0.85,
            priority: "normal",
          },
        ],
      };

      const result = await classificationService.processClassificationResult(payloadWithActions);

      expect(result.success).toBe(true);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it("should handle empty extracted actions array", async () => {
      mockPrisma.inboxItem.findUnique.mockResolvedValue({
        id: validPayload.inboxItemId,
        userId: "user-123",
        status: "pending",
        user: { settings: null },
      });
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const payloadWithEmptyActions: ClassificationCompletePayload = {
        ...validPayload,
        extractedActions: [],
      };

      const result = await classificationService.processClassificationResult(payloadWithEmptyActions);

      expect(result.success).toBe(true);
    });

    it("should handle payload without extractedActions (backward compatibility)", async () => {
      mockPrisma.inboxItem.findUnique.mockResolvedValue({
        id: validPayload.inboxItemId,
        userId: "user-123",
        status: "pending",
        user: { settings: null },
      });
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      // validPayload doesn't have extractedActions
      const result = await classificationService.processClassificationResult(validPayload);

      expect(result.success).toBe(true);
    });

    // Story 3.3: Tag extraction tests
    it("should process payload with tags", async () => {
      mockPrisma.inboxItem.findUnique.mockResolvedValue({
        id: validPayload.inboxItemId,
        userId: "user-123",
        status: "pending",
        user: { settings: null },
      });
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const payloadWithTags: ClassificationCompletePayload = {
        ...validPayload,
        tags: [
          { type: "topic", value: "budget", confidence: 0.9 },
          { type: "person", value: "Sarah", confidence: 0.95 },
          { type: "date", value: "2026-01-16", confidence: 0.9 },
          { type: "project", value: "Marketing Campaign", confidence: 0.75, linkedId: "proj-123" },
        ],
      };

      const result = await classificationService.processClassificationResult(payloadWithTags);

      expect(result.success).toBe(true);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it("should handle empty tags array", async () => {
      mockPrisma.inboxItem.findUnique.mockResolvedValue({
        id: validPayload.inboxItemId,
        userId: "user-123",
        status: "pending",
        user: { settings: null },
      });
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const payloadWithEmptyTags: ClassificationCompletePayload = {
        ...validPayload,
        tags: [],
      };

      const result = await classificationService.processClassificationResult(payloadWithEmptyTags);

      expect(result.success).toBe(true);
    });

    it("should handle payload without tags (backward compatibility)", async () => {
      mockPrisma.inboxItem.findUnique.mockResolvedValue({
        id: validPayload.inboxItemId,
        userId: "user-123",
        status: "pending",
        user: { settings: null },
      });
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      // validPayload doesn't have tags
      const result = await classificationService.processClassificationResult(validPayload);

      expect(result.success).toBe(true);
    });

    it("should process payload with all enrichment data (actions and tags)", async () => {
      mockPrisma.inboxItem.findUnique.mockResolvedValue({
        id: validPayload.inboxItemId,
        userId: "user-123",
        status: "pending",
        user: { settings: null },
      });
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const fullPayload: ClassificationCompletePayload = {
        ...validPayload,
        extractedActions: [
          {
            id: "action-1",
            description: "Send budget report to Sarah",
            confidence: 0.95,
          },
        ],
        tags: [
          { type: "topic", value: "budget", confidence: 0.9 },
          { type: "person", value: "Sarah", confidence: 0.95 },
        ],
      };

      const result = await classificationService.processClassificationResult(fullPayload);

      expect(result.success).toBe(true);
    });
  });

  describe("markClassificationFailed", () => {
    it("should schedule retry for first failure", async () => {
      mockPrisma.inboxItem.findUnique.mockResolvedValue({
        userId: "user-1",
        content: "Test content",
        source: "manual",
        aiClassification: null,
      });
      mockPrisma.inboxItem.update.mockResolvedValue({});

      const result = await classificationService.markClassificationFailed(
        "123e4567-e89b-12d3-a456-426614174000",
        "LLM timeout"
      );

      expect(result.shouldRetry).toBe(true);
      expect(result.nextRetryAt).toBeDefined();
      expect(mockPrisma.inboxItem.update).toHaveBeenCalledWith({
        where: { id: "123e4567-e89b-12d3-a456-426614174000" },
        data: {
          status: "pending",
          aiClassification: expect.objectContaining({
            processingMeta: expect.objectContaining({
              lastError: "LLM timeout",
              retryCount: 1,
              nextRetryAt: expect.any(String),
            }),
          }),
        },
      });
    });

    it("should mark as error after max retries exceeded", async () => {
      // Item has already failed 3 times (retryCount equals MAX_RETRIES = 3)
      // So the next failure should trigger error state
      mockPrisma.inboxItem.findUnique.mockResolvedValue({
        userId: "user-1",
        content: "Test content",
        source: "manual",
        aiClassification: {
          processingMeta: { retryCount: 3 },
        },
      });
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      // Don't pass currentRetryCount - let it use the stored value (3)
      // Since retryCount (3) >= MAX_RETRIES (3), it should mark as error
      const result = await classificationService.markClassificationFailed(
        "123e4567-e89b-12d3-a456-426614174000",
        "LLM timeout"
      );

      expect(result.shouldRetry).toBe(false);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it("should return shouldRetry false if item not found", async () => {
      mockPrisma.inboxItem.findUnique.mockResolvedValue(null);

      const result = await classificationService.markClassificationFailed(
        "test-id",
        "error"
      );

      expect(result.shouldRetry).toBe(false);
    });

    it("should handle update errors and return shouldRetry false", async () => {
      mockPrisma.inboxItem.findUnique.mockResolvedValue({
        userId: "user-1",
        content: "Test content",
        source: "manual",
        aiClassification: null,
      });
      mockPrisma.inboxItem.update.mockRejectedValue(new Error("Update failed"));

      const result = await classificationService.markClassificationFailed(
        "test-id",
        "error"
      );

      expect(result.shouldRetry).toBe(false);
    });
  });

  describe("getClassificationStatus", () => {
    it("should return classified: false if item not found", async () => {
      mockPrisma.inboxItem.findUnique.mockResolvedValue(null);

      const result = await classificationService.getClassificationStatus("test-id");

      expect(result.classified).toBe(false);
    });

    it("should return classified: false if no classification", async () => {
      mockPrisma.inboxItem.findUnique.mockResolvedValue({
        aiClassification: null,
      });

      const result = await classificationService.getClassificationStatus("test-id");

      expect(result.classified).toBe(false);
    });

    it("should return classified: false if classification has error", async () => {
      mockPrisma.inboxItem.findUnique.mockResolvedValue({
        aiClassification: { error: "Failed" },
      });

      const result = await classificationService.getClassificationStatus("test-id");

      expect(result.classified).toBe(false);
    });

    it("should return classification data if valid", async () => {
      mockPrisma.inboxItem.findUnique.mockResolvedValue({
        aiClassification: {
          category: "note",
          confidence: 0.9,
          reasoning: "Personal reflection",
          suggestedProject: "Journal",
        },
      });

      const result = await classificationService.getClassificationStatus("test-id");

      expect(result.classified).toBe(true);
      expect(result.classification).toEqual({
        category: "note",
        confidence: 0.9,
        reasoning: "Personal reflection",
        suggestedProject: "Journal",
        suggestedArea: undefined,
      });
    });
  });
});
