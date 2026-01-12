import { prisma, Prisma } from "@packages/db";
import { randomUUID } from "crypto";

// Re-export types for InboxItem from Prisma
type InboxItem = Prisma.InboxItemGetPayload<object>;
type ReviewSession = Prisma.ReviewSessionGetPayload<object>;

// Types for session actions
export interface SessionAction {
  id: string;
  itemId: string;
  action: "agree" | "disagree" | "urgent" | "hide";
  timestamp: string; // ISO string for JSON serialization
  undone: boolean;
  previousState: {
    status: string;
    extractedActions?: Record<string, unknown>[];
  };
  correctionId?: string;
}

export interface SessionStats {
  agreed: number;
  disagreed: number;
  urgent: number;
  hidden: number;
  totalTimeMs: number;
  expired?: boolean;
}

export interface SwipeActionResult {
  action: "agree" | "disagree" | "urgent" | "hide";
  message: string;
  undoable: boolean;
  openModal?: "correction";
  previousState: {
    status: string;
    extractedActions?: Record<string, unknown>[];
  };
}

interface ExtractedAction {
  id: string;
  description: string;
  confidence: number;
  priority?: string;
  owner?: string | null;
  dueDate?: string | null;
  [key: string]: unknown;
}

/**
 * Handle "agree" swipe (right) - user accepts AI classification
 */
async function handleAgree(
  item: InboxItem,
  sessionId: string
): Promise<SwipeActionResult> {
  const classification = item.aiClassification as { category?: string } | null;
  const previousState = {
    status: item.status,
    extractedActions: (item.extractedActions || []) as Record<string, unknown>[],
  };

  // Update inbox item
  await prisma.inboxItem.update({
    where: { id: item.id },
    data: {
      status: "reviewed",
      reviewedAt: new Date(),
      userFeedback: {
        agreed: true,
        reviewedAt: new Date().toISOString(),
        sessionId,
      },
    },
  });

  // Update classification audit if exists
  await prisma.classificationAudit.updateMany({
    where: { inboxItemId: item.id },
    data: {
      userAction: "agree",
      reviewType: "daily_swipe",
      userReviewedAt: new Date(),
      sessionId,
    },
  });

  return {
    action: "agree",
    message: `Filed as ${classification?.category || "reviewed"}`,
    undoable: true,
    previousState,
  };
}

/**
 * Handle "disagree" swipe (left) - user rejects AI classification
 */
async function handleDisagree(
  item: InboxItem,
  sessionId: string
): Promise<SwipeActionResult> {
  const previousState = {
    status: item.status,
    extractedActions: (item.extractedActions || []) as Record<string, unknown>[],
  };

  // Mark as needing correction (don't change status yet)
  await prisma.inboxItem.update({
    where: { id: item.id },
    data: {
      userFeedback: {
        agreed: false,
        needsCorrection: true,
        sessionId,
      },
    },
  });

  return {
    action: "disagree",
    message: "Choose how to fix",
    undoable: true,
    openModal: "correction",
    previousState,
  };
}

/**
 * Handle "urgent" swipe (up) - mark item as urgent priority
 */
async function handleUrgent(
  item: InboxItem,
  sessionId: string
): Promise<SwipeActionResult> {
  const previousState = {
    status: item.status,
    extractedActions: (item.extractedActions || []) as Record<string, unknown>[],
  };

  const existingActions = (item.extractedActions || []) as ExtractedAction[];

  let updatedActions: ExtractedAction[];

  if (existingActions.length > 0) {
    // Mark first extracted action as urgent
    updatedActions = existingActions.map((a, i) => ({
      ...a,
      priority: i === 0 ? "urgent" : a.priority || "normal",
    }));
  } else {
    // Create an urgent action from the content
    const truncatedContent =
      item.content.length > 100
        ? item.content.substring(0, 100) + "..."
        : item.content;

    updatedActions = [
      {
        id: randomUUID(),
        description: truncatedContent,
        confidence: 1.0,
        priority: "urgent",
        owner: null,
        dueDate: null,
      },
    ];
  }

  await prisma.inboxItem.update({
    where: { id: item.id },
    data: {
      status: "reviewed",
      reviewedAt: new Date(),
      extractedActions: updatedActions as unknown as Prisma.InputJsonValue,
      userFeedback: {
        agreed: true,
        markedUrgent: true,
        sessionId,
      },
    },
  });

  // Update classification audit
  await prisma.classificationAudit.updateMany({
    where: { inboxItemId: item.id },
    data: {
      userAction: "urgent",
      reviewType: "daily_swipe",
      userReviewedAt: new Date(),
      sessionId,
    },
  });

  return {
    action: "urgent",
    message: "Marked as urgent priority",
    undoable: true,
    previousState,
  };
}

/**
 * Handle "hide" swipe (down) - archive the item
 */
async function handleHide(
  item: InboxItem,
  sessionId: string
): Promise<SwipeActionResult> {
  const previousState = {
    status: item.status,
    extractedActions: (item.extractedActions || []) as Record<string, unknown>[],
  };

  await prisma.inboxItem.update({
    where: { id: item.id },
    data: {
      status: "archived",
      archivedAt: new Date(),
      userFeedback: {
        agreed: false,
        hidden: true,
        sessionId,
      },
    },
  });

  // Update classification audit
  await prisma.classificationAudit.updateMany({
    where: { inboxItemId: item.id },
    data: {
      userAction: "hide",
      reviewType: "daily_swipe",
      userReviewedAt: new Date(),
      sessionId,
    },
  });

  return {
    action: "hide",
    message: "Item archived",
    undoable: true,
    previousState,
  };
}

/**
 * Main swipe handler - routes to appropriate action
 */
export async function handleSwipe(
  direction: "right" | "left" | "up" | "down",
  item: InboxItem,
  sessionId: string
): Promise<SwipeActionResult> {
  switch (direction) {
    case "right":
      return handleAgree(item, sessionId);
    case "left":
      return handleDisagree(item, sessionId);
    case "up":
      return handleUrgent(item, sessionId);
    case "down":
      return handleHide(item, sessionId);
  }
}

/**
 * Undo a swipe action
 */
export async function undoSwipe(
  itemId: string,
  previousState: { status: string; extractedActions?: Record<string, unknown>[] }
): Promise<{ success: boolean; message: string }> {
  await prisma.inboxItem.update({
    where: { id: itemId },
    data: {
      status: previousState.status,
      reviewedAt: previousState.status === "reviewed" ? undefined : null,
      archivedAt: previousState.status === "archived" ? undefined : null,
      extractedActions: (previousState.extractedActions || []) as unknown as Prisma.InputJsonValue,
      userFeedback: Prisma.JsonNull,
    },
  });

  // Revert classification audit
  await prisma.classificationAudit.updateMany({
    where: { inboxItemId: itemId },
    data: {
      userAction: null,
      userReviewedAt: null,
    },
  });

  return { success: true, message: "Action undone" };
}

/**
 * Get or create a review session
 */
export async function getOrCreateSession(
  userId: string,
  forceNew = false
): Promise<ReviewSession> {
  // Find active session
  const existingSession = await prisma.reviewSession.findFirst({
    where: {
      userId,
      completedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { startedAt: "desc" },
  });

  if (existingSession && !forceNew) {
    // Update last activity
    return prisma.reviewSession.update({
      where: { id: existingSession.id },
      data: { lastActivityAt: new Date() },
    });
  }

  // Archive any expired sessions
  await prisma.reviewSession.updateMany({
    where: {
      userId,
      completedAt: null,
      expiresAt: { lte: new Date() },
    },
    data: {
      completedAt: new Date(),
      stats: { expired: true },
    },
  });

  // Create new session
  const pendingItems = await prisma.inboxItem.findMany({
    where: {
      userId,
      status: { in: ["pending", "processing"] },
      aiClassification: { not: Prisma.JsonNull },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  return prisma.reviewSession.create({
    data: {
      userId,
      itemIds: pendingItems.map((i) => i.id),
      currentIndex: 0,
      actions: [],
      startedAt: now,
      lastActivityAt: now,
      expiresAt,
      stats: {
        agreed: 0,
        disagreed: 0,
        urgent: 0,
        hidden: 0,
        totalTimeMs: 0,
      },
    },
  });
}

/**
 * Record a swipe action in the session
 */
export async function recordSessionAction(
  sessionId: string,
  action: SessionAction
): Promise<void> {
  const session = await prisma.reviewSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) return;

  const currentActions = (session.actions as unknown as SessionAction[]) || [];
  const currentStats = (session.stats as unknown as SessionStats) || {
    agreed: 0,
    disagreed: 0,
    urgent: 0,
    hidden: 0,
    totalTimeMs: 0,
  };

  // Update stats based on action
  const statsUpdate = { ...currentStats };
  switch (action.action) {
    case "agree":
      statsUpdate.agreed++;
      break;
    case "disagree":
      statsUpdate.disagreed++;
      break;
    case "urgent":
      statsUpdate.urgent++;
      break;
    case "hide":
      statsUpdate.hidden++;
      break;
  }

  const updatedActions = [...currentActions, action] as unknown as Prisma.InputJsonValue;

  await prisma.reviewSession.update({
    where: { id: sessionId },
    data: {
      actions: updatedActions,
      currentIndex: { increment: 1 },
      lastActivityAt: new Date(),
      stats: statsUpdate as unknown as Prisma.InputJsonValue,
    },
  });
}

/**
 * Mark an action as undone in the session
 */
export async function markActionUndone(
  sessionId: string,
  itemId: string
): Promise<void> {
  const session = await prisma.reviewSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) return;

  const actions = (session.actions as unknown as SessionAction[]) || [];
  const currentStats = (session.stats as unknown as SessionStats) || {
    agreed: 0,
    disagreed: 0,
    urgent: 0,
    hidden: 0,
    totalTimeMs: 0,
  };

  // Find and mark the last action for this item as undone
  const lastActionIndex = actions.findLastIndex(
    (a) => a.itemId === itemId && !a.undone
  );

  if (lastActionIndex === -1) return;

  const undoneAction = actions[lastActionIndex];
  actions[lastActionIndex] = { ...undoneAction, undone: true };

  // Decrement the appropriate stat
  const statsUpdate = { ...currentStats };
  switch (undoneAction.action) {
    case "agree":
      statsUpdate.agreed = Math.max(0, statsUpdate.agreed - 1);
      break;
    case "disagree":
      statsUpdate.disagreed = Math.max(0, statsUpdate.disagreed - 1);
      break;
    case "urgent":
      statsUpdate.urgent = Math.max(0, statsUpdate.urgent - 1);
      break;
    case "hide":
      statsUpdate.hidden = Math.max(0, statsUpdate.hidden - 1);
      break;
  }

  await prisma.reviewSession.update({
    where: { id: sessionId },
    data: {
      actions: actions as unknown as Prisma.InputJsonValue,
      currentIndex: { decrement: 1 },
      lastActivityAt: new Date(),
      stats: statsUpdate as unknown as Prisma.InputJsonValue,
    },
  });
}

/**
 * Complete a review session
 */
export async function completeSession(sessionId: string): Promise<ReviewSession> {
  const session = await prisma.reviewSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  const actions = (session.actions as unknown as SessionAction[]) || [];
  const activeActions = actions.filter((a) => !a.undone);

  const stats: SessionStats = {
    agreed: activeActions.filter((a) => a.action === "agree").length,
    disagreed: activeActions.filter((a) => a.action === "disagree").length,
    urgent: activeActions.filter((a) => a.action === "urgent").length,
    hidden: activeActions.filter((a) => a.action === "hide").length,
    totalTimeMs: Date.now() - new Date(session.startedAt).getTime(),
  };

  return prisma.reviewSession.update({
    where: { id: sessionId },
    data: {
      completedAt: new Date(),
      stats: stats as unknown as Prisma.InputJsonValue,
    },
  });
}
