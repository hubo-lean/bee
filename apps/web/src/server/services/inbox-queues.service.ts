import { prisma } from "@packages/db";

const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Get items that need review (low confidence AI classification)
 */
export async function getNeedsReviewQueue(userId: string) {
  // Get user's confidence threshold setting
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  });

  const settings = user?.settings as { confidenceThreshold?: number } | null;
  const threshold = settings?.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

  // Find pending items with low confidence
  const items = await prisma.inboxItem.findMany({
    where: {
      userId,
      status: "pending",
    },
    orderBy: { createdAt: "asc" },
  });

  // Filter by confidence threshold (JSON field)
  return items.filter((item) => {
    const classification = item.aiClassification as { confidence?: number } | null;
    if (!classification) return true; // No classification = needs review
    return (classification.confidence ?? 0) < threshold;
  });
}

/**
 * Get items user disagreed with during daily triage (deferred to weekly review)
 */
export async function getDisagreementsQueue(userId: string) {
  const items = await prisma.inboxItem.findMany({
    where: {
      userId,
      status: "pending",
    },
    orderBy: { createdAt: "asc" },
  });

  // Filter to items with deferredToWeekly flag
  return items.filter((item) => {
    const feedback = item.userFeedback as { deferredToWeekly?: boolean } | null;
    return feedback?.deferredToWeekly === true;
  });
}

/**
 * Get queue counts for the inbox step
 */
export async function getQueueCounts(userId: string) {
  const [needsReview, disagreements] = await Promise.all([
    getNeedsReviewQueue(userId),
    getDisagreementsQueue(userId),
  ]);

  const needsReviewCount = needsReview.length;
  const disagreementsCount = disagreements.length;
  const mandatoryCount = needsReviewCount + disagreementsCount;

  return {
    needsReview: needsReviewCount,
    disagreements: disagreementsCount,
    mandatory: mandatoryCount,
    isComplete: mandatoryCount === 0,
  };
}

/**
 * Archive all items in a queue
 */
export async function archiveQueueItems(userId: string, queue: "needsReview" | "disagreements") {
  const items =
    queue === "needsReview"
      ? await getNeedsReviewQueue(userId)
      : await getDisagreementsQueue(userId);

  if (items.length === 0) return { archived: 0 };

  await prisma.inboxItem.updateMany({
    where: {
      id: { in: items.map((i) => i.id) },
      userId,
    },
    data: {
      status: "archived",
      archivedAt: new Date(),
    },
  });

  return { archived: items.length };
}

/**
 * File all items in a queue to a project or area
 */
export async function fileQueueItemsTo(
  userId: string,
  queue: "needsReview" | "disagreements",
  destination: { type: "project" | "area"; id: string }
) {
  const items =
    queue === "needsReview"
      ? await getNeedsReviewQueue(userId)
      : await getDisagreementsQueue(userId);

  if (items.length === 0) return { filed: 0 };

  // Create notes for each item
  const notePromises = items.map((item) =>
    prisma.note.create({
      data: {
        userId,
        title: item.content.slice(0, 100),
        content: item.content,
        projectId: destination.type === "project" ? destination.id : undefined,
        areaId: destination.type === "area" ? destination.id : undefined,
        sourceInboxItemId: item.id,
      },
    })
  );

  await Promise.all(notePromises);

  // Update inbox items
  await prisma.inboxItem.updateMany({
    where: {
      id: { in: items.map((i) => i.id) },
      userId,
    },
    data: {
      status: "reviewed",
      reviewedAt: new Date(),
    },
  });

  return { filed: items.length };
}

/**
 * Process a single inbox item (archive)
 */
export async function archiveInboxItem(userId: string, itemId: string) {
  return prisma.inboxItem.update({
    where: { id: itemId, userId },
    data: {
      status: "archived",
      archivedAt: new Date(),
    },
  });
}
