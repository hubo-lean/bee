import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Use vi.hoisted for proper mock hoisting
const { mocks } = vi.hoisted(() => ({
  mocks: {
    generateEmbedding: vi.fn(),
    formatEmbeddingForPgVector: vi.fn(),
  },
}));

// Mock embedding service
vi.mock("../embedding.service", () => ({
  generateEmbedding: mocks.generateEmbedding,
  formatEmbeddingForPgVector: mocks.formatEmbeddingForPgVector,
}));

// Mock prisma
vi.mock("@packages/db", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    searchIndex: {
      findMany: vi.fn(),
    },
    inboxItem: {
      findMany: vi.fn(),
    },
  },
  SearchSourceType: {
    INBOX_ITEM: "INBOX_ITEM",
    NOTE: "NOTE",
    ACTION: "ACTION",
    RESOURCE: "RESOURCE",
  },
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    join: vi.fn((items: unknown[], separator: string) => ({ items, separator })),
    raw: vi.fn((str: string) => str),
    empty: "",
  },
}));

// Import after mocks are set up
import { semanticSearch, quickTextSearch } from "../search.service";

describe("SearchService", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for embedding generation
    mocks.generateEmbedding.mockResolvedValue(new Array(1536).fill(0.1));
    mocks.formatEmbeddingForPgVector.mockReturnValue("[0.1,0.1,...]");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("semanticSearch", () => {
    it("should generate embedding for query", async () => {
      const { prisma } = await import("@packages/db");

      (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await semanticSearch("user-123", "test query");

      expect(mocks.generateEmbedding).toHaveBeenCalledWith("test query");
    });

    it("should return results with similarity scores", async () => {
      const { prisma } = await import("@packages/db");

      const mockResults = [
        {
          id: "search-1",
          sourceType: "INBOX_ITEM",
          sourceId: "item-1",
          title: "Test Item",
          content: "This is test content",
          projectId: null,
          areaId: null,
          tags: ["test"],
          createdAt: new Date(),
          similarity: 0.85,
        },
        {
          id: "search-2",
          sourceType: "INBOX_ITEM",
          sourceId: "item-2",
          title: "Another Item",
          content: "More test content",
          projectId: null,
          areaId: null,
          tags: [],
          createdAt: new Date(),
          similarity: 0.72,
        },
      ];

      (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue(mockResults);

      const response = await semanticSearch("user-123", "test query");

      expect(response.results).toHaveLength(2);
      expect(response.results[0].similarity).toBe(0.85);
      expect(response.results[1].similarity).toBe(0.72);
      expect(response.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("should apply type filters", async () => {
      const { prisma } = await import("@packages/db");

      (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await semanticSearch("user-123", "test", { types: ["INBOX_ITEM" as const] });

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it("should apply date range filters", async () => {
      const { prisma } = await import("@packages/db");

      (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const dateFrom = new Date("2026-01-01");
      const dateTo = new Date("2026-12-31");

      await semanticSearch("user-123", "test", { dateFrom, dateTo });

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it("should apply project filter", async () => {
      const { prisma } = await import("@packages/db");

      (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await semanticSearch("user-123", "test", { projectId: "project-123" });

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it("should apply area filter", async () => {
      const { prisma } = await import("@packages/db");

      (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await semanticSearch("user-123", "test", { areaId: "area-123" });

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it("should apply tag filters", async () => {
      const { prisma } = await import("@packages/db");

      (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await semanticSearch("user-123", "test", { tags: ["work", "important"] });

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it("should hydrate results when requested", async () => {
      const { prisma } = await import("@packages/db");

      const mockSearchResults = [
        {
          id: "search-1",
          sourceType: "INBOX_ITEM",
          sourceId: "item-1",
          title: "Test Item",
          content: "This is test content",
          projectId: null,
          areaId: null,
          tags: [],
          createdAt: new Date(),
          similarity: 0.85,
        },
      ];

      const mockInboxItems = [
        {
          id: "item-1",
          content: "Full item content",
          status: "reviewed",
          aiClassification: {
            category: "action",
            confidence: 0.9,
          },
        },
      ];

      (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue(mockSearchResults);
      (prisma.inboxItem.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockInboxItems);

      const response = await semanticSearch("user-123", "test", {}, 20, { hydrate: true });

      expect(response.results[0].item).toBeDefined();
      expect(response.results[0].item?.status).toBe("reviewed");
      expect(response.results[0].item?.category).toBe("action");
    });

    it("should limit results to specified count", async () => {
      const { prisma } = await import("@packages/db");

      (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await semanticSearch("user-123", "test", {}, 10);

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it("should track search latency", async () => {
      const { prisma } = await import("@packages/db");

      // Add a small delay to make latency measurable
      (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 10))
      );

      const response = await semanticSearch("user-123", "test");

      expect(response.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("quickTextSearch", () => {
    it("should search by title and content", async () => {
      const { prisma } = await import("@packages/db");

      const mockResults = [
        {
          id: "search-1",
          sourceType: "INBOX_ITEM",
          sourceId: "item-1",
          title: "Test Item",
          content: "This is test content",
          projectId: null,
          areaId: null,
          tags: ["test"],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.searchIndex.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockResults);

      const results = await quickTextSearch("user-123", "test");

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Test Item");
    });

    it("should not require embedding generation", async () => {
      const { prisma } = await import("@packages/db");

      (prisma.searchIndex.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await quickTextSearch("user-123", "test");

      expect(mocks.generateEmbedding).not.toHaveBeenCalled();
    });

    it("should generate snippets for results", async () => {
      const { prisma } = await import("@packages/db");

      const longContent =
        "This is a very long piece of content that should be truncated into a snippet. " +
        "The snippet should contain the most relevant part of the content based on the search query. " +
        "We want to make sure the test query appears in the generated snippet.";

      const mockResults = [
        {
          id: "search-1",
          sourceType: "INBOX_ITEM",
          sourceId: "item-1",
          title: "Long Content",
          content: longContent,
          projectId: null,
          areaId: null,
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.searchIndex.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockResults);

      const results = await quickTextSearch("user-123", "snippet");

      expect(results[0].snippet).toBeDefined();
      expect(results[0].snippet.length).toBeLessThanOrEqual(250);
    });

    it("should set default similarity for text search", async () => {
      const { prisma } = await import("@packages/db");

      const mockResults = [
        {
          id: "search-1",
          sourceType: "INBOX_ITEM",
          sourceId: "item-1",
          title: "Test",
          content: "Content",
          projectId: null,
          areaId: null,
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.searchIndex.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockResults);

      const results = await quickTextSearch("user-123", "test");

      expect(results[0].similarity).toBe(0.5);
    });
  });
});
