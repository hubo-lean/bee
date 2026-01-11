import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

// Mock the classification service
vi.mock("@/server/services/classification.service", () => ({
  classificationService: {
    processClassificationResult: vi.fn(),
  },
}));

import { classificationService } from "@/server/services/classification.service";

const mockProcessClassificationResult = classificationService.processClassificationResult as ReturnType<typeof vi.fn>;

function createMockRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
    headers: new Headers(headers),
  } as unknown as NextRequest;
}

describe("POST /api/webhooks/classification-complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variable
    delete process.env.N8N_WEBHOOK_SECRET;
  });

  const validPayload = {
    inboxItemId: "123e4567-e89b-12d3-a456-426614174000",
    classification: {
      category: "action",
      confidence: 0.85,
      reasoning: "Contains task-like language",
    },
    modelUsed: "claude-3-opus",
    processingTimeMs: 1200,
  };

  it("should accept valid classification payload", async () => {
    mockProcessClassificationResult.mockResolvedValue({ success: true });
    const request = createMockRequest(validPayload);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockProcessClassificationResult).toHaveBeenCalledWith(validPayload);
  });

  it("should reject unauthorized requests when secret is configured", async () => {
    process.env.N8N_WEBHOOK_SECRET = "test-secret";
    const request = createMockRequest(validPayload, {});

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should accept requests with correct secret", async () => {
    process.env.N8N_WEBHOOK_SECRET = "test-secret";
    mockProcessClassificationResult.mockResolvedValue({ success: true });
    const request = createMockRequest(validPayload, {
      "X-Webhook-Secret": "test-secret",
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
  });

  it("should reject invalid payload - missing inboxItemId", async () => {
    const invalidPayload = { ...validPayload, inboxItemId: undefined };
    const request = createMockRequest(invalidPayload);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid payload");
  });

  it("should reject invalid payload - invalid category", async () => {
    const invalidPayload = {
      ...validPayload,
      classification: { ...validPayload.classification, category: "invalid" },
    };
    const request = createMockRequest(invalidPayload);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid payload");
  });

  it("should reject invalid payload - confidence out of range", async () => {
    const invalidPayload = {
      ...validPayload,
      classification: { ...validPayload.classification, confidence: 1.5 },
    };
    const request = createMockRequest(invalidPayload);

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("should handle processing failures", async () => {
    mockProcessClassificationResult.mockResolvedValue({
      success: false,
      error: "InboxItem not found",
    });
    const request = createMockRequest(validPayload);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBe("InboxItem not found");
  });

  it("should handle JSON parse errors", async () => {
    const request = {
      json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
      headers: new Headers({}),
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Invalid JSON");
  });

  it("should accept all valid category types", async () => {
    const categories = ["action", "note", "reference", "meeting", "unknown"];

    for (const category of categories) {
      mockProcessClassificationResult.mockResolvedValue({ success: true });
      const request = createMockRequest({
        ...validPayload,
        classification: { ...validPayload.classification, category },
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    }
  });

  it("should accept optional suggestedProject and suggestedArea", async () => {
    mockProcessClassificationResult.mockResolvedValue({ success: true });
    const request = createMockRequest({
      ...validPayload,
      classification: {
        ...validPayload.classification,
        suggestedProject: "Work Project",
        suggestedArea: "Career",
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });

  // Story 3.2: Action extraction tests
  describe("extractedActions (Story 3.2)", () => {
    it("should accept payload with extracted actions", async () => {
      mockProcessClassificationResult.mockResolvedValue({ success: true });
      const request = createMockRequest({
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
            priority: "high",
          },
        ],
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it("should accept empty extracted actions array", async () => {
      mockProcessClassificationResult.mockResolvedValue({ success: true });
      const request = createMockRequest({
        ...validPayload,
        extractedActions: [],
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it("should accept payload without extractedActions (backward compatibility)", async () => {
      mockProcessClassificationResult.mockResolvedValue({ success: true });
      const request = createMockRequest(validPayload);

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it("should validate action priority values", async () => {
      mockProcessClassificationResult.mockResolvedValue({ success: true });

      // Valid priorities
      const validPriorities = ["urgent", "high", "normal", "low"];
      for (const priority of validPriorities) {
        const request = createMockRequest({
          ...validPayload,
          extractedActions: [
            {
              id: "action-1",
              description: "Test action",
              confidence: 0.8,
              priority,
            },
          ],
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
      }
    });

    it("should reject invalid priority value", async () => {
      const request = createMockRequest({
        ...validPayload,
        extractedActions: [
          {
            id: "action-1",
            description: "Test action",
            confidence: 0.8,
            priority: "invalid-priority",
          },
        ],
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it("should reject action with confidence out of range", async () => {
      const request = createMockRequest({
        ...validPayload,
        extractedActions: [
          {
            id: "action-1",
            description: "Test action",
            confidence: 1.5, // Invalid - above 1
          },
        ],
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it("should accept action with optional sourceSpan", async () => {
      mockProcessClassificationResult.mockResolvedValue({ success: true });
      const request = createMockRequest({
        ...validPayload,
        extractedActions: [
          {
            id: "action-1",
            description: "Send budget report",
            confidence: 0.9,
            sourceSpan: { start: 10, end: 50 },
          },
        ],
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });

  // Story 3.3: Tag tests
  describe("tags (Story 3.3)", () => {
    it("should accept payload with tags", async () => {
      mockProcessClassificationResult.mockResolvedValue({ success: true });
      const request = createMockRequest({
        ...validPayload,
        tags: [
          { type: "topic", value: "budget", confidence: 0.9 },
          { type: "person", value: "Sarah", confidence: 0.95 },
          { type: "date", value: "2026-01-16", confidence: 0.9 },
          { type: "project", value: "Marketing Campaign", confidence: 0.75, linkedId: "proj-123" },
        ],
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it("should accept empty tags array", async () => {
      mockProcessClassificationResult.mockResolvedValue({ success: true });
      const request = createMockRequest({
        ...validPayload,
        tags: [],
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it("should accept payload without tags (backward compatibility)", async () => {
      mockProcessClassificationResult.mockResolvedValue({ success: true });
      const request = createMockRequest(validPayload);

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it("should validate all tag types", async () => {
      mockProcessClassificationResult.mockResolvedValue({ success: true });

      const tagTypes = ["topic", "person", "project", "area", "date", "location"];
      for (const type of tagTypes) {
        const request = createMockRequest({
          ...validPayload,
          tags: [{ type, value: "test value", confidence: 0.8 }],
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
      }
    });

    it("should reject invalid tag type", async () => {
      const request = createMockRequest({
        ...validPayload,
        tags: [{ type: "invalid-type", value: "test", confidence: 0.8 }],
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it("should reject tag with confidence out of range", async () => {
      const request = createMockRequest({
        ...validPayload,
        tags: [{ type: "topic", value: "test", confidence: 1.5 }],
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it("should accept tag with optional linkedId", async () => {
      mockProcessClassificationResult.mockResolvedValue({ success: true });
      const request = createMockRequest({
        ...validPayload,
        tags: [
          { type: "project", value: "Marketing", confidence: 0.8, linkedId: "proj-456" },
          { type: "area", value: "Work", confidence: 0.75, linkedId: "area-123" },
        ],
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it("should accept full payload with all enrichment data", async () => {
      mockProcessClassificationResult.mockResolvedValue({ success: true });
      const request = createMockRequest({
        ...validPayload,
        extractedActions: [
          { id: "action-1", description: "Send report", confidence: 0.9 },
        ],
        tags: [
          { type: "topic", value: "budget", confidence: 0.9 },
          { type: "person", value: "Sarah", confidence: 0.95 },
        ],
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });
});
