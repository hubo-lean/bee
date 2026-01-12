import OpenAI from "openai";
import { prisma } from "@packages/db";
import { classificationService, MAX_RETRIES, RETRY_DELAYS } from "./classification.service";
import { indexContentAsync } from "./search-index.service";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CLASSIFICATION_PROMPT = `You are an AI assistant that classifies inbox items for a personal productivity app called Bee.

Analyze the content and return a JSON response with:
1. category: "action" | "note" | "reference" | "meeting" | "unknown"
2. confidence: 0.0-1.0 (how certain you are)
3. reasoning: Brief explanation (1-2 sentences)
4. extractedActions: Array of action items (if category is "action")
5. tags: Array of extracted tags

CLASSIFICATION RULES:
- "action": Contains something the user needs to DO
  - Keywords: call, buy, schedule, email, send, fix, update, create, book, remind
  - Examples: "Call John tomorrow", "Buy groceries", "Schedule dentist appointment"

- "note": Information to remember but no action required
  - Examples: "Great quote from the book", "Interesting fact about space"

- "reference": Reference material to save for later
  - Examples: "Article about React patterns", "Link to documentation"

- "meeting": Meeting notes, agenda items, or calendar-related
  - Examples: "Meeting with Sarah - discussed Q4 goals", "Team standup notes"

- "unknown": Cannot determine category with confidence
  - Use when content is ambiguous or unclear

For extractedActions, include:
- description: The action text
- confidence: How certain this is an action (0.0-1.0)
- priority: "urgent" | "high" | "normal" | "low" (based on language)
- dueDate: ISO date string if mentioned (null otherwise)

For tags, include:
- type: "topic" | "person" | "project" | "area" | "date" | "location"
- value: The extracted value

Return ONLY valid JSON matching this schema.`;

// Classification result structure
export interface AIClassificationResult {
  category: "action" | "note" | "reference" | "meeting" | "unknown";
  confidence: number;
  reasoning: string;
  extractedActions: Array<{
    description: string;
    confidence: number;
    priority?: "urgent" | "high" | "normal" | "low";
    dueDate?: string | null;
  }>;
  tags: Array<{
    type: "topic" | "person" | "project" | "area" | "date" | "location";
    value: string;
  }>;
}

// Context for classification
export interface ClassificationContext {
  areas?: string[];
  projects?: string[];
  source?: string;
}

// Service configuration
const AI_CLASSIFICATION_CONFIG = {
  MODEL: "gpt-4o-mini",
  MAX_RETRIES: 3,
  CONFIDENCE_THRESHOLD: 0.6,
  MAX_CONTENT_LENGTH: 4000,
  TEMPERATURE: 0.3,
  MAX_TOKENS: 1000,
  BATCH_CONCURRENCY: 5,
};

/**
 * AI Classification Service for direct OpenAI integration
 * Replaces n8n-based classification for faster, more reliable processing
 */
export class AIClassificationService {
  /**
   * Classify a single inbox item using OpenAI
   */
  async classifyItem(
    itemId: string,
    content: string,
    context?: ClassificationContext
  ): Promise<AIClassificationResult> {
    const startTime = Date.now();

    // Mark item as processing
    await classificationService.markProcessingStarted(itemId);

    // Build context message
    const contextLines: string[] = [];
    if (context?.source) {
      contextLines.push(`Source: ${context.source}`);
    }
    if (context?.areas?.length) {
      contextLines.push(`User's areas: ${context.areas.join(", ")}`);
    }
    if (context?.projects?.length) {
      contextLines.push(`User's active projects: ${context.projects.join(", ")}`);
    }

    const userMessage = `Content to classify:
"""
${content.slice(0, AI_CLASSIFICATION_CONFIG.MAX_CONTENT_LENGTH)}
"""
${contextLines.length ? "\nContext:\n" + contextLines.join("\n") : ""}`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < AI_CLASSIFICATION_CONFIG.MAX_RETRIES; attempt++) {
      try {
        const response = await openai.chat.completions.create({
          model: AI_CLASSIFICATION_CONFIG.MODEL,
          messages: [
            { role: "system", content: CLASSIFICATION_PROMPT },
            { role: "user", content: userMessage },
          ],
          response_format: { type: "json_object" },
          temperature: AI_CLASSIFICATION_CONFIG.TEMPERATURE,
          max_tokens: AI_CLASSIFICATION_CONFIG.MAX_TOKENS,
        });

        const processingTimeMs = Date.now() - startTime;
        const responseContent = response.choices[0].message.content;

        if (!responseContent) {
          throw new Error("Empty response from OpenAI");
        }

        const result = JSON.parse(responseContent) as AIClassificationResult;

        // Validate result structure
        if (!result.category || typeof result.confidence !== "number") {
          throw new Error("Invalid classification response structure");
        }

        // Normalize result
        const normalizedResult = this.normalizeResult(result);

        // Store result in database
        await this.storeClassification(itemId, normalizedResult, processingTimeMs);

        return normalizedResult;
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `[AIClassificationService] Attempt ${attempt + 1} failed for item ${itemId}:`,
          error
        );

        // Wait before retry (exponential backoff)
        if (attempt < AI_CLASSIFICATION_CONFIG.MAX_RETRIES - 1) {
          const delay = RETRY_DELAYS[attempt] ?? Math.pow(2, attempt) * 1000;
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    // All retries failed - mark as error
    await this.markClassificationFailed(itemId, lastError);
    throw lastError;
  }

  /**
   * Normalize classification result to ensure consistent structure
   */
  private normalizeResult(result: AIClassificationResult): AIClassificationResult {
    return {
      category: result.category || "unknown",
      confidence: Math.max(0, Math.min(1, result.confidence || 0)),
      reasoning: result.reasoning || "Classification completed",
      extractedActions: Array.isArray(result.extractedActions)
        ? result.extractedActions.map((action) => ({
            description: action.description || "",
            confidence: action.confidence || 0.5,
            priority: action.priority || "normal",
            dueDate: action.dueDate || null,
          }))
        : [],
      tags: Array.isArray(result.tags)
        ? result.tags.map((tag) => ({
            type: tag.type || "topic",
            value: tag.value || "",
          }))
        : [],
    };
  }

  /**
   * Store classification result in database
   */
  private async storeClassification(
    itemId: string,
    result: AIClassificationResult,
    processingTimeMs: number
  ): Promise<void> {
    // Get user's confidence threshold and content
    const item = await prisma.inboxItem.findUnique({
      where: { id: itemId },
      select: {
        userId: true,
        content: true,
        user: { select: { settings: true } },
      },
    });

    if (!item) {
      throw new Error("Item not found");
    }

    const userSettings = item.user?.settings as Record<string, unknown> | null;
    const threshold =
      (userSettings?.confidenceThreshold as number) ??
      AI_CLASSIFICATION_CONFIG.CONFIDENCE_THRESHOLD;

    const shouldAutoFile = result.confidence >= threshold;

    // Update item and create audit in a transaction
    await prisma.$transaction([
      prisma.inboxItem.update({
        where: { id: itemId },
        data: {
          aiClassification: {
            category: result.category,
            confidence: result.confidence,
            reasoning: result.reasoning,
            modelUsed: AI_CLASSIFICATION_CONFIG.MODEL,
            processingTimeMs,
            processedAt: new Date().toISOString(),
            autoFiled: shouldAutoFile,
          },
          extractedActions: JSON.parse(JSON.stringify(result.extractedActions)),
          tags: JSON.parse(JSON.stringify(result.tags)),
          status: shouldAutoFile ? "reviewed" : "pending",
          reviewedAt: shouldAutoFile ? new Date() : undefined,
        },
      }),
      prisma.classificationAudit.create({
        data: {
          inboxItemId: itemId,
          userId: item.userId,
          aiCategory: result.category,
          aiConfidence: result.confidence,
          aiReasoning: result.reasoning,
          aiModel: AI_CLASSIFICATION_CONFIG.MODEL,
          aiProcessedAt: new Date(),
          reviewType: "auto",
        },
      }),
    ]);

    // Index for semantic search (async, non-blocking)
    // Builds searchable content from item content + classification metadata
    const searchableContent = [
      item.content,
      result.reasoning,
      result.extractedActions?.map((a) => a.description).join(" "),
      result.tags?.map((t) => t.value).join(" "),
    ]
      .filter(Boolean)
      .join("\n\n");

    const title =
      result.extractedActions?.[0]?.description || item.content.slice(0, 100);

    indexContentAsync({
      sourceType: "INBOX_ITEM",
      sourceId: itemId,
      userId: item.userId,
      content: searchableContent,
      title,
      tags: result.tags?.map((t) => t.value) || [],
    });
  }

  /**
   * Mark item as failed classification
   */
  private async markClassificationFailed(
    itemId: string,
    error: Error | null
  ): Promise<void> {
    const errorMessage = error?.message || "Classification failed after retries";

    // Use existing service logic for proper retry handling
    await classificationService.markClassificationFailed(
      itemId,
      errorMessage,
      MAX_RETRIES
    );
  }

  /**
   * Batch classify multiple items with controlled concurrency
   */
  async classifyBatch(
    items: Array<{ id: string; content: string }>,
    context?: ClassificationContext
  ): Promise<{ succeeded: number; failed: number; results: Map<string, AIClassificationResult | Error> }> {
    const CONCURRENCY = AI_CLASSIFICATION_CONFIG.BATCH_CONCURRENCY;
    let succeeded = 0;
    let failed = 0;
    const results = new Map<string, AIClassificationResult | Error>();

    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const batch = items.slice(i, i + CONCURRENCY);

      const batchResults = await Promise.allSettled(
        batch.map((item) => this.classifyItem(item.id, item.content, context))
      );

      batchResults.forEach((result, index) => {
        const itemId = batch[index].id;
        if (result.status === "fulfilled") {
          succeeded++;
          results.set(itemId, result.value);
        } else {
          failed++;
          results.set(itemId, result.reason as Error);
        }
      });
    }

    return { succeeded, failed, results };
  }

  /**
   * Re-classify an existing item
   */
  async reclassifyItem(
    itemId: string,
    context?: ClassificationContext
  ): Promise<AIClassificationResult> {
    const item = await prisma.inboxItem.findUnique({
      where: { id: itemId },
      select: { content: true, source: true },
    });

    if (!item) {
      throw new Error("Item not found");
    }

    return this.classifyItem(itemId, item.content, {
      ...context,
      source: item.source,
    });
  }

  /**
   * Get user context for classification
   */
  async getUserContext(userId: string): Promise<ClassificationContext> {
    const [areas, projects] = await Promise.all([
      prisma.area.findMany({
        where: { userId },
        select: { name: true },
      }),
      prisma.project.findMany({
        where: { userId, status: "active" },
        select: { name: true },
      }),
    ]);

    return {
      areas: areas.map((a) => a.name),
      projects: projects.map((p) => p.name),
    };
  }

  /**
   * Check if OpenAI is properly configured
   */
  static isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  /**
   * Test OpenAI connection
   */
  static async testConnection(): Promise<{ success: boolean; error?: string; latency?: number }> {
    if (!AIClassificationService.isConfigured()) {
      return { success: false, error: "OPENAI_API_KEY not configured" };
    }

    const start = Date.now();

    try {
      await openai.models.list();
      return {
        success: true,
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
        latency: Date.now() - start,
      };
    }
  }
}

// Export singleton instance
export const aiClassificationService = new AIClassificationService();
