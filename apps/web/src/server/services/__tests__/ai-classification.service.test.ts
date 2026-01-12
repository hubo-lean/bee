import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AIClassificationService, aiClassificationService, type AIClassificationResult } from "../ai-classification.service";

// Mock the OpenAI client
vi.mock("openai", () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
      models: {
        list: vi.fn().mockResolvedValue({ data: [] }),
      },
    })),
    mockCreate,
  };
});

// Mock prisma
vi.mock("@packages/db", () => ({
  prisma: {
    inboxItem: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    area: {
      findMany: vi.fn(),
    },
    project: {
      findMany: vi.fn(),
    },
    classificationAudit: {
      create: vi.fn(),
    },
    failedWebhook: {
      create: vi.fn(),
    },
    $transaction: vi.fn((fns) => Promise.all(fns)),
  },
  Prisma: {},
  InboxItem: {},
}));

// Mock the classification service
vi.mock("../classification.service", () => ({
  classificationService: {
    markProcessingStarted: vi.fn().mockResolvedValue(undefined),
    markClassificationFailed: vi.fn().mockResolvedValue({ shouldRetry: false }),
  },
  MAX_RETRIES: 3,
  RETRY_DELAYS: [1000, 5000, 30000],
}));

// Mock the search-index service (used for async indexing after classification)
vi.mock("../search-index.service", () => ({
  indexContentAsync: vi.fn(),
}));

describe("AIClassificationService", () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Get the mockCreate from the module
    const openaiModule = await import("openai");
    mockCreate = (openaiModule as unknown as { mockCreate: ReturnType<typeof vi.fn> }).mockCreate;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isConfigured", () => {
    it("should return true when OPENAI_API_KEY is set", () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = "test-key";
      expect(AIClassificationService.isConfigured()).toBe(true);
      process.env.OPENAI_API_KEY = originalEnv;
    });

    it("should return false when OPENAI_API_KEY is not set", () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      expect(AIClassificationService.isConfigured()).toBe(false);
      process.env.OPENAI_API_KEY = originalEnv;
    });
  });

  describe("classifyItem", () => {
    const mockClassificationResponse: AIClassificationResult = {
      category: "action",
      confidence: 0.85,
      reasoning: "This is a task to complete",
      extractedActions: [
        {
          description: "Call John tomorrow",
          confidence: 0.9,
          priority: "normal",
          dueDate: null,
        },
      ],
      tags: [
        { type: "person", value: "John" },
        { type: "date", value: "tomorrow" },
      ],
    };

    beforeEach(async () => {
      const { prisma } = await import("@packages/db");

      // Setup prisma mocks
      (prisma.inboxItem.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "test-item-id",
        userId: "test-user-id",
        content: "Test content for classification",
        user: { settings: { confidenceThreshold: 0.6 } },
      });

      (prisma.inboxItem.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "test-item-id",
        status: "reviewed",
      });

      (prisma.classificationAudit.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "audit-id",
      });

      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (ops) => {
        const results = [];
        for (const op of ops) {
          results.push(await op);
        }
        return results;
      });

      // Setup OpenAI mock
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(mockClassificationResponse),
            },
          },
        ],
      });
    });

    it("should classify an item successfully", async () => {
      const result = await aiClassificationService.classifyItem(
        "test-item-id",
        "Call John tomorrow about the project",
        { source: "manual" }
      );

      expect(result).toEqual(mockClassificationResponse);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it("should include context in the prompt", async () => {
      await aiClassificationService.classifyItem(
        "test-item-id",
        "Test content",
        {
          source: "voice",
          areas: ["Work", "Personal"],
          projects: ["Project Alpha", "Project Beta"],
        }
      );

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages[1].content;

      expect(userMessage).toContain("Source: voice");
      expect(userMessage).toContain("User's areas: Work, Personal");
      expect(userMessage).toContain("User's active projects: Project Alpha, Project Beta");
    });

    it("should truncate long content", async () => {
      const longContent = "x".repeat(5000);

      await aiClassificationService.classifyItem("test-item-id", longContent, {
        source: "manual",
      });

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages[1].content;

      // Content should be truncated to 4000 characters
      expect(userMessage.length).toBeLessThan(longContent.length + 500);
    });

    it("should handle action category classification", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: "action",
                confidence: 0.9,
                reasoning: "Contains a clear task",
                extractedActions: [
                  {
                    description: "Buy groceries",
                    confidence: 0.95,
                    priority: "normal",
                    dueDate: null,
                  },
                ],
                tags: [{ type: "topic", value: "shopping" }],
              }),
            },
          },
        ],
      });

      const result = await aiClassificationService.classifyItem(
        "test-item-id",
        "Buy groceries today"
      );

      expect(result.category).toBe("action");
      expect(result.extractedActions).toHaveLength(1);
    });

    it("should handle note category classification", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: "note",
                confidence: 0.8,
                reasoning: "This is information to remember",
                extractedActions: [],
                tags: [{ type: "topic", value: "quote" }],
              }),
            },
          },
        ],
      });

      const result = await aiClassificationService.classifyItem(
        "test-item-id",
        "Great quote: The only limit is your imagination"
      );

      expect(result.category).toBe("note");
      expect(result.extractedActions).toHaveLength(0);
    });

    it("should handle meeting category classification", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: "meeting",
                confidence: 0.85,
                reasoning: "Contains meeting notes",
                extractedActions: [],
                tags: [
                  { type: "person", value: "Sarah" },
                  { type: "topic", value: "Q4 goals" },
                ],
              }),
            },
          },
        ],
      });

      const result = await aiClassificationService.classifyItem(
        "test-item-id",
        "Meeting with Sarah - discussed Q4 goals"
      );

      expect(result.category).toBe("meeting");
    });

    it("should normalize malformed responses", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: "action",
                confidence: 1.5, // Invalid: > 1
                reasoning: "",
                extractedActions: null, // Invalid: should be array
                tags: "not-an-array", // Invalid: should be array
              }),
            },
          },
        ],
      });

      const result = await aiClassificationService.classifyItem(
        "test-item-id",
        "Test content"
      );

      expect(result.confidence).toBe(1); // Clamped to 1
      expect(result.reasoning).toBe("Classification completed");
      expect(result.extractedActions).toEqual([]);
      expect(result.tags).toEqual([]);
    });

    it("should retry on API error", async () => {
      mockCreate
        .mockRejectedValueOnce(new Error("API Error"))
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: JSON.stringify(mockClassificationResponse),
              },
            },
          ],
        });

      // Mock setTimeout to avoid actual delays
      vi.useFakeTimers();

      const promise = aiClassificationService.classifyItem(
        "test-item-id",
        "Test content"
      );

      // Advance timers to skip retry delay
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;

      vi.useRealTimers();

      expect(result).toEqual(mockClassificationResponse);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });
  });

  describe("classifyBatch", () => {
    beforeEach(async () => {
      const { prisma } = await import("@packages/db");

      (prisma.inboxItem.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "test-item-id",
        userId: "test-user-id",
        content: "Test content",
        user: { settings: {} },
      });

      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (ops) => {
        const results = [];
        for (const op of ops) {
          results.push(await op);
        }
        return results;
      });

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: "note",
                confidence: 0.8,
                reasoning: "Test",
                extractedActions: [],
                tags: [],
              }),
            },
          },
        ],
      });
    });

    it("should classify multiple items", async () => {
      const items = [
        { id: "item-1", content: "Content 1" },
        { id: "item-2", content: "Content 2" },
        { id: "item-3", content: "Content 3" },
      ];

      const result = await aiClassificationService.classifyBatch(items);

      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results.size).toBe(3);
    });

    it("should handle partial failures in batch", async () => {
      // Use fake timers to skip retry delays
      vi.useFakeTimers();

      mockCreate
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  category: "note",
                  confidence: 0.8,
                  reasoning: "Test",
                  extractedActions: [],
                  tags: [],
                }),
              },
            },
          ],
        })
        .mockRejectedValueOnce(new Error("API Error"))
        .mockRejectedValueOnce(new Error("API Error"))
        .mockRejectedValueOnce(new Error("API Error"));

      const items = [
        { id: "item-1", content: "Content 1" },
        { id: "item-2", content: "Content 2" },
      ];

      const resultPromise = aiClassificationService.classifyBatch(items);

      // Advance timers to skip all retry delays
      await vi.advanceTimersByTimeAsync(60000);

      const result = await resultPromise;

      vi.useRealTimers();

      // First item succeeds, second fails after retries
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
    }, 10000);
  });

  describe("getUserContext", () => {
    it("should fetch user areas and projects", async () => {
      const { prisma } = await import("@packages/db");

      (prisma.area.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { name: "Work" },
        { name: "Personal" },
      ]);

      (prisma.project.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { name: "Project Alpha" },
        { name: "Project Beta" },
      ]);

      const context = await aiClassificationService.getUserContext("user-123");

      expect(context).toEqual({
        areas: ["Work", "Personal"],
        projects: ["Project Alpha", "Project Beta"],
      });
    });
  });

  describe("testConnection", () => {
    it("should return success when API key is valid", async () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = "test-key";

      const result = await AIClassificationService.testConnection();

      expect(result.success).toBe(true);
      expect(result.latency).toBeDefined();

      process.env.OPENAI_API_KEY = originalEnv;
    });

    it("should return error when API key is not configured", async () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const result = await AIClassificationService.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe("OPENAI_API_KEY not configured");

      process.env.OPENAI_API_KEY = originalEnv;
    });
  });
});
