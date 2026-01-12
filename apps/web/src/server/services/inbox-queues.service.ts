import { prisma, type InboxItem } from "@packages/db";

const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Get items that need review (low confidence AI classification)
 * Uses raw SQL to filter JSON fields in the database instead of JavaScript
 */
export async function getNeedsReviewQueue(userId: string) {
  // Get user's confidence threshold setting
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  });

  const settings = user?.settings as { confidenceThreshold?: number } | null;
  const threshold = settings?.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

  // Filter in database using raw SQL for JSON operations
  const items = await prisma.$queryRaw<InboxItem[]>`
    SELECT * FROM "InboxItem"
    WHERE "userId" = ${userId}
      AND status = 'pending'
      AND (
        "aiClassification" IS NULL
        OR ("aiClassification"->>'confidence')::float < ${threshold}
      )
    ORDER BY "createdAt" ASC
    LIMIT 100
  `;

  return items;
}

/**
 * Get items user disagreed with during daily triage (deferred to weekly review)
 * Uses raw SQL to filter JSON fields in the database instead of JavaScript
 */
export async function getDisagreementsQueue(userId: string) {
  // Filter in database using raw SQL for JSON operations
  const items = await prisma.$queryRaw<InboxItem[]>`
    SELECT * FROM "InboxItem"
    WHERE "userId" = ${userId}
      AND status = 'pending'
      AND "userFeedback" IS NOT NULL
      AND ("userFeedback"->>'deferredToWeekly')::boolean = true
    ORDER BY "createdAt" ASC
    LIMIT 100
  `;

  return items;
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
