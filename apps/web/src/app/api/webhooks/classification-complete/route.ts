import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  classificationService,
  type ClassificationCompletePayload,
} from "@/server/services/classification.service";

// Schema for action candidate (Story 3.2)
const actionCandidateSchema = z.object({
  id: z.string(),
  description: z.string(),
  confidence: z.number().min(0).max(1),
  owner: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(["urgent", "high", "normal", "low"]).optional(),
  sourceSpan: z
    .object({
      start: z.number(),
      end: z.number(),
    })
    .optional(),
});

// Schema for tag (Story 3.3)
const tagSchema = z.object({
  type: z.enum(["topic", "person", "project", "area", "date", "location"]),
  value: z.string(),
  confidence: z.number().min(0).max(1),
  linkedId: z.string().optional(),
});

// Schema for validating incoming classification results
const classificationPayloadSchema = z.object({
  inboxItemId: z.string().uuid(),
  classification: z.object({
    category: z.enum(["action", "note", "reference", "meeting", "unknown"]),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
    suggestedProject: z.string().optional(),
    suggestedArea: z.string().optional(),
  }),
  extractedActions: z.array(actionCandidateSchema).optional(),
  tags: z.array(tagSchema).optional(),
  modelUsed: z.string(),
  processingTimeMs: z.number().positive(),
});

/**
 * Verify the webhook secret from n8n
 */
function verifyWebhookSecret(request: NextRequest): boolean {
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

  // If no secret configured, allow all requests (dev mode)
  if (!webhookSecret) {
    return true;
  }

  const providedSecret = request.headers.get("X-Webhook-Secret");
  return providedSecret === webhookSecret;
}

/**
 * POST /api/webhooks/classification-complete
 * Receives classification results from n8n workflow
 */
export async function POST(request: NextRequest) {
  // Verify webhook authenticity
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    // Validate payload
    const parseResult = classificationPayloadSchema.safeParse(body);

    if (!parseResult.success) {
      console.error(
        "[ClassificationWebhook] Invalid payload:",
        parseResult.error.issues
      );
      return NextResponse.json(
        {
          success: false,
          error: "Invalid payload",
          details: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const payload: ClassificationCompletePayload = parseResult.data;

    // Process the classification result
    const result = await classificationService.processClassificationResult(payload);

    if (!result.success) {
      console.error("[ClassificationWebhook] Processing failed:", result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ClassificationWebhook] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
