import { prisma, Prisma } from "@packages/db";

export interface ActionCorrection {
  originalId?: string;
  description: string;
  keep: boolean;
  isNew: boolean;
}

export interface CorrectionInput {
  inboxItemId: string;
  userId: string;
  sessionId: string;
  correctionType: "fix_now" | "weekly_review";
  correctedCategory?: string;
  correctedActions?: ActionCorrection[];
  userReason?: string;
}

export interface CorrectionResult {
  action: "deferred" | "corrected";
  message: string;
}

/**
 * Process a user correction for an inbox item
 */
export async function processCorrection(
  correction: CorrectionInput
): Promise<CorrectionResult> {
  const {
    inboxItemId,
    userId,
    sessionId,
    correctionType,
    correctedCategory,
    correctedActions,
    userReason,
  } = correction;

  if (correctionType === "weekly_review") {
    // Mark for weekly review - defer processing
    await prisma.inboxItem.update({
      where: { id: inboxItemId },
      data: {
        status: "pending",
        userFeedback: {
          agreed: false,
          deferredToWeekly: true,
          sessionId,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return { action: "deferred", message: "Sent to weekly review" };
  }

  // Fix now - apply corrections
  const item = await prisma.inboxItem.findUnique({
    where: { id: inboxItemId },
  });

  if (!item) {
    throw new Error("Item not found");
  }

  const aiClassification = item.aiClassification as Record<string, unknown> | null;
  const originalCategory = (aiClassification?.category as string) || "unknown";
  const originalConfidence = (aiClassification?.confidence as number) || 0;

  // Build corrected classification
  const correctedClassification = {
    ...aiClassification,
    userCorrected: true,
    originalCategory,
    category: correctedCategory,
    correctedAt: new Date().toISOString(),
  };

  // Build corrected actions
  const existingActions = (item.extractedActions as Array<{
    id: string;
    description: string;
    confidence: number;
    priority?: string;
    owner?: string | null;
    dueDate?: string | null;
  }>) || [];

  const keptActions = (correctedActions || [])
    .filter((a) => a.keep)
    .map((a) => {
      const existingAction = existingActions.find((ea) => ea.id === a.originalId);
      return {
        id: a.originalId || crypto.randomUUID(),
        description: a.description,
        confidence: a.isNew ? 1.0 : existingAction?.confidence || 0.5,
        priority: existingAction?.priority || "normal",
        owner: existingAction?.owner || null,
        dueDate: existingAction?.dueDate || null,
        userAdded: a.isNew,
      };
    });

  // Update inbox item
  await prisma.inboxItem.update({
    where: { id: inboxItemId },
    data: {
      status: "reviewed",
      reviewedAt: new Date(),
      aiClassification: correctedClassification as unknown as Prisma.InputJsonValue,
      extractedActions: keptActions as unknown as Prisma.InputJsonValue,
      userFeedback: {
        agreed: false,
        corrected: true,
        correctedCategory,
        userReason,
        sessionId,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  // Create correction record for AI training
  await prisma.userCorrection.create({
    data: {
      inboxItemId,
      userId,
      originalCategory,
      originalConfidence,
      correctedCategory: correctedCategory || "unknown",
      correctedActions: correctedActions as unknown as Prisma.InputJsonValue,
      userReason,
      content: item.content,
    },
  });

  return {
    action: "corrected",
    message: `Re-filed as ${correctedCategory}`,
  };
}

/**
 * Get correction insights for AI improvement
 */
export async function getCorrectionInsights(userId: string) {
  const corrections = await prisma.userCorrection.groupBy({
    by: ["originalCategory", "correctedCategory"],
    where: { userId },
    _count: {
      _all: true,
    },
    orderBy: {
      _count: {
        originalCategory: "desc",
      },
    },
  });

  // Find common misclassifications
  const misclassifications = corrections
    .filter((c) => c.originalCategory !== c.correctedCategory)
    .map((c) => ({
      from: c.originalCategory,
      to: c.correctedCategory,
      count: c._count._all,
    }));

  return {
    totalCorrections: corrections.reduce((sum, c) => sum + (c._count._all || 0), 0),
    misclassifications,
  };
}
