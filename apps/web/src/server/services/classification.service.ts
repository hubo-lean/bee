import { prisma } from "@packages/db";

// Classification categories
export type ClassificationCategory =
  | "action"
  | "note"
  | "reference"
  | "meeting"
  | "unknown";

// Classification result from AI
export interface ClassificationResult {
  category: ClassificationCategory;
  confidence: number;
  reasoning: string;
  suggestedProject?: string;
  suggestedArea?: string;
}

// Action candidate extracted from content (Story 3.2)
export interface ActionCandidate {
  id: string;
  description: string;
  confidence: number;
  owner?: string;
  dueDate?: string;
  priority?: "urgent" | "high" | "normal" | "low";
  sourceSpan?: {
    start: number;
    end: number;
  };
}

// Tag extracted from content (Story 3.3)
export type TagType = "topic" | "person" | "project" | "area" | "date" | "location";

export interface Tag {
  type: TagType;
  value: string;
  confidence: number;
  linkedId?: string; // ID of linked Project/Area/Contact
}

// Payload from n8n webhook
export interface ClassificationCompletePayload {
  inboxItemId: string;
  classification: ClassificationResult;
  extractedActions?: ActionCandidate[];
  tags?: Tag[];
  modelUsed: string;
  processingTimeMs: number;
}

// Story 3.5: Processing metadata for queue management
export interface ProcessingMeta {
  startedAt?: string;
  completedAt?: string;
  lastError?: string;
  retryCount?: number;
  nextRetryAt?: string;
  failedAt?: string;
  processingTimeMs?: number;
}

// Story 3.5: Queue constants
export const MAX_RETRIES = 3;
export const RETRY_DELAYS = [1000, 5000, 30000]; // 1s, 5s, 30s

// Threshold for auto-review
const AUTO_REVIEW_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Classification service for processing AI classification results
 */
export const classificationService = {
  /**
   * Process classification result from n8n webhook
   */
  async processClassificationResult(
    payload: ClassificationCompletePayload
  ): Promise<{ success: boolean; error?: string }> {
    const { inboxItemId, classification, extractedActions, tags, modelUsed, processingTimeMs } = payload;

    try {
      // Fetch the inbox item and user settings to get confidence threshold
      const inboxItem = await prisma.inboxItem.findUnique({
        where: { id: inboxItemId },
        select: {
          id: true,
          userId: true,
          status: true,
          user: {
            select: { settings: true },
          },
        },
      });

      if (!inboxItem) {
        return { success: false, error: "InboxItem not found" };
      }

      // Get user's confidence threshold from settings (default to 0.6)
      const userSettings = inboxItem.user?.settings as Record<string, unknown> | null;
      const threshold = (userSettings?.confidenceThreshold as number) ?? AUTO_REVIEW_CONFIDENCE_THRESHOLD;

      // Determine new status based on confidence vs user threshold (Story 3.4)
      const isHighConfidence = classification.confidence >= threshold;
      const newStatus = isHighConfidence ? "reviewed" : "pending";

      // Update inbox item and create audit record in a transaction
      await prisma.$transaction([
        // Update InboxItem with classification and extracted actions
        prisma.inboxItem.update({
          where: { id: inboxItemId },
          data: {
            status: newStatus,
            // Set reviewedAt timestamp for high-confidence auto-filed items (Story 3.4)
            reviewedAt: isHighConfidence ? new Date() : undefined,
            aiClassification: {
              category: classification.category,
              confidence: classification.confidence,
              reasoning: classification.reasoning,
              suggestedProject: classification.suggestedProject,
              suggestedArea: classification.suggestedArea,
              modelUsed,
              processingTimeMs,
              processedAt: new Date().toISOString(),
              autoFiled: isHighConfidence, // Track if this was auto-filed (Story 3.4)
            },
            // Store extracted actions (Story 3.2) - cast to Prisma JSON type
            extractedActions: JSON.parse(JSON.stringify(extractedActions ?? [])),
            // Store tags (Story 3.3) - cast to Prisma JSON type
            tags: JSON.parse(JSON.stringify(tags ?? [])),
          },
        }),

        // Create ClassificationAudit record
        prisma.classificationAudit.create({
          data: {
            inboxItemId,
            userId: inboxItem.userId,
            aiCategory: classification.category,
            aiConfidence: classification.confidence,
            aiReasoning: classification.reasoning,
            aiModel: modelUsed,
            aiProcessedAt: new Date(),
            reviewType: "auto",
          },
        }),
      ]);

      return { success: true };
    } catch (error) {
      console.error("[ClassificationService] Error processing result:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  /**
   * Story 3.5: Mark classification as failed with retry logic
   * Returns true if should retry, false if max retries exceeded
   */
  async markClassificationFailed(
    inboxItemId: string,
    error: string,
    currentRetryCount = 0
  ): Promise<{ shouldRetry: boolean; nextRetryAt?: Date }> {
    try {
      const item = await prisma.inboxItem.findUnique({
        where: { id: inboxItemId },
        select: { userId: true, content: true, source: true, aiClassification: true },
      });

      if (!item) {
        console.error("[ClassificationService] Item not found:", inboxItemId);
        return { shouldRetry: false };
      }

      // Get current retry count from existing classification meta
      const existingClassification = item.aiClassification as Record<string, unknown> | null;
      const processingMeta = (existingClassification?.processingMeta as ProcessingMeta) ?? {};
      const retryCount = currentRetryCount || (processingMeta.retryCount ?? 0);

      if (retryCount < MAX_RETRIES) {
        // Schedule retry
        const nextRetryAt = new Date(Date.now() + RETRY_DELAYS[retryCount]);

        await prisma.inboxItem.update({
          where: { id: inboxItemId },
          data: {
            status: "pending",
            aiClassification: {
              ...existingClassification,
              processingMeta: {
                ...processingMeta,
                lastError: error,
                retryCount: retryCount + 1,
                nextRetryAt: nextRetryAt.toISOString(),
              },
            },
          },
        });

        console.warn(
          `[ClassificationService] Retry ${retryCount + 1}/${MAX_RETRIES} scheduled for item ${inboxItemId}`
        );

        return { shouldRetry: true, nextRetryAt };
      } else {
        // Max retries exceeded - mark as error and create FailedWebhook
        await prisma.$transaction([
          prisma.inboxItem.update({
            where: { id: inboxItemId },
            data: {
              status: "error",
              aiClassification: {
                ...existingClassification,
                error,
                processingMeta: {
                  ...processingMeta,
                  lastError: error,
                  retryCount,
                  failedAt: new Date().toISOString(),
                },
              },
            },
          }),
          // Create FailedWebhook record for monitoring
          prisma.failedWebhook.create({
            data: {
              type: "classify",
              targetUrl: process.env.N8N_CLASSIFY_WEBHOOK_URL ?? "n8n-classification",
              payload: {
                inboxItemId,
                content: item.content.substring(0, 500), // Truncate for storage
                source: item.source,
              },
              error,
              retryCount: MAX_RETRIES,
              maxRetries: MAX_RETRIES,
              status: "failed",
            },
          }),
        ]);

        console.error(
          `[ClassificationService] Max retries exceeded for item ${inboxItemId}:`,
          error
        );

        return { shouldRetry: false };
      }
    } catch (err) {
      console.error("[ClassificationService] Error marking failed:", err);
      return { shouldRetry: false };
    }
  },

  /**
   * Story 3.5: Mark item as processing (started classification)
   */
  async markProcessingStarted(inboxItemId: string): Promise<void> {
    try {
      const item = await prisma.inboxItem.findUnique({
        where: { id: inboxItemId },
        select: { aiClassification: true },
      });

      const existingClassification = (item?.aiClassification as Record<string, unknown>) ?? {};
      const processingMeta = (existingClassification.processingMeta as ProcessingMeta) ?? {};

      await prisma.inboxItem.update({
        where: { id: inboxItemId },
        data: {
          status: "processing",
          aiClassification: {
            ...existingClassification,
            processingMeta: {
              ...processingMeta,
              startedAt: new Date().toISOString(),
            },
          },
        },
      });
    } catch (err) {
      console.error("[ClassificationService] Error marking processing started:", err);
    }
  },

  /**
   * Story 3.5: Reset item for retry (manual retry from error state)
   */
  async resetForRetry(inboxItemId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const item = await prisma.inboxItem.findUnique({
        where: { id: inboxItemId },
        select: { status: true, aiClassification: true },
      });

      if (!item) {
        return { success: false, error: "Item not found" };
      }

      if (item.status !== "error") {
        return { success: false, error: "Item is not in error state" };
      }

      // Reset to pending with cleared error state
      await prisma.inboxItem.update({
        where: { id: inboxItemId },
        data: {
          status: "pending",
          aiClassification: {
            processingMeta: {
              retryCount: 0,
              lastError: null,
              failedAt: null,
              nextRetryAt: null,
            },
          },
        },
      });

      return { success: true };
    } catch (err) {
      console.error("[ClassificationService] Error resetting for retry:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },

  /**
   * Get classification status for an inbox item
   */
  async getClassificationStatus(
    inboxItemId: string
  ): Promise<{ classified: boolean; classification?: ClassificationResult }> {
    const item = await prisma.inboxItem.findUnique({
      where: { id: inboxItemId },
      select: { aiClassification: true },
    });

    if (!item || !item.aiClassification) {
      return { classified: false };
    }

    const classification = item.aiClassification as Record<string, unknown>;

    if (classification.error) {
      return { classified: false };
    }

    return {
      classified: true,
      classification: {
        category: classification.category as ClassificationCategory,
        confidence: classification.confidence as number,
        reasoning: classification.reasoning as string,
        suggestedProject: classification.suggestedProject as string | undefined,
        suggestedArea: classification.suggestedArea as string | undefined,
      },
    };
  },
};
