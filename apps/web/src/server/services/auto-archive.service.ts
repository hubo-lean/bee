import { prisma } from "@packages/db";
import { subDays, addDays, format } from "date-fns";

const DEFAULT_AUTO_ARCHIVE_DAYS = 15;
const WARNING_DAYS_BEFORE = 2;

interface AutoArchiveResult {
  warned: number;
  archived: number;
}

interface UserSettings {
  autoArchiveDays?: number;
}

/**
 * Process auto-archive for a user
 * - Warns items approaching the cutoff
 * - Archives items past the cutoff
 */
export async function processAutoArchive(userId: string): Promise<AutoArchiveResult> {
  // Get user's auto-archive setting
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  });

  const settings = user?.settings as UserSettings | null;
  const autoArchiveDays = settings?.autoArchiveDays ?? DEFAULT_AUTO_ARCHIVE_DAYS;

  // If auto-archive is disabled, skip
  if (autoArchiveDays === 0) {
    return { warned: 0, archived: 0 };
  }

  const now = new Date();
  const archiveCutoff = subDays(now, autoArchiveDays);
  const warningCutoff = subDays(now, autoArchiveDays - WARNING_DAYS_BEFORE);

  // 1. Set warnings on items approaching cutoff (not yet warned)
  const warningResult = await prisma.inboxItem.updateMany({
    where: {
      userId,
      status: { in: ["pending", "processing"] },
      createdAt: { lt: warningCutoff, gte: archiveCutoff },
      autoArchiveWarning: null,
    },
    data: {
      autoArchiveWarning: true,
      autoArchiveDate: addDays(now, WARNING_DAYS_BEFORE),
    },
  });

  // 2. Archive items past the cutoff
  const itemsToArchive = await prisma.inboxItem.findMany({
    where: {
      userId,
      status: { in: ["pending", "processing"] },
      createdAt: { lt: archiveCutoff },
    },
    select: { id: true, tags: true },
  });

  if (itemsToArchive.length > 0) {
    // Archive each item and add the system tag
    for (const item of itemsToArchive) {
      const existingTags = (item.tags as Array<{ type: string; value: string; confidence: number }>) || [];
      const newTag = {
        type: "system",
        value: `Unprocessed - ${format(now, "yyyy-MM-dd")}`,
        confidence: 1.0,
      };

      await prisma.inboxItem.update({
        where: { id: item.id },
        data: {
          status: "archived",
          archivedAt: now,
          tags: [...existingTags, newTag],
        },
      });
    }

    // Log the auto-archive event
    await prisma.auditLog.create({
      data: {
        userId,
        action: "AUTO_ARCHIVE",
        metadata: {
          itemsArchived: itemsToArchive.length,
          timestamp: now,
        },
      },
    });
  }

  return {
    warned: warningResult.count,
    archived: itemsToArchive.length,
  };
}

/**
 * Declare inbox bankruptcy - archive all pending items
 */
export async function declareBankruptcy(userId: string): Promise<{ archived: number }> {
  const now = new Date();

  // Get all pending items
  const itemsToArchive = await prisma.inboxItem.findMany({
    where: {
      userId,
      status: { in: ["pending", "processing"] },
    },
    select: { id: true, tags: true },
  });

  if (itemsToArchive.length === 0) {
    return { archived: 0 };
  }

  // Archive each item and add the bankruptcy tag
  for (const item of itemsToArchive) {
    const existingTags = (item.tags as Array<{ type: string; value: string; confidence: number }>) || [];
    const newTag = {
      type: "system",
      value: `Bankruptcy - ${format(now, "yyyy-MM-dd")}`,
      confidence: 1.0,
    };

    await prisma.inboxItem.update({
      where: { id: item.id },
      data: {
        status: "archived",
        archivedAt: now,
        tags: [...existingTags, newTag],
      },
    });
  }

  // Log the bankruptcy event
  await prisma.auditLog.create({
    data: {
      userId,
      action: "INBOX_BANKRUPTCY",
      metadata: {
        itemsArchived: itemsToArchive.length,
        timestamp: now,
      },
    },
  });

  return { archived: itemsToArchive.length };
}

/**
 * Get items with auto-archive warnings
 */
export async function getAutoArchiveWarnings(userId: string) {
  return prisma.inboxItem.findMany({
    where: {
      userId,
      status: { in: ["pending", "processing"] },
      autoArchiveWarning: true,
    },
    orderBy: { autoArchiveDate: "asc" },
    select: {
      id: true,
      content: true,
      createdAt: true,
      autoArchiveDate: true,
    },
  });
}

/**
 * Get pending item count
 */
export async function getPendingCount(userId: string): Promise<number> {
  return prisma.inboxItem.count({
    where: {
      userId,
      status: { in: ["pending", "processing"] },
    },
  });
}

/**
 * Restore an item from archive
 */
export async function restoreFromArchive(userId: string, itemId: string) {
  // Get the item to restore
  const item = await prisma.inboxItem.findUnique({
    where: { id: itemId },
    select: { id: true, userId: true, tags: true },
  });

  if (!item || item.userId !== userId) {
    throw new Error("Item not found");
  }

  // Filter out system tags
  const existingTags = (item.tags as Array<{ type: string; value: string; confidence: number }>) || [];
  const filteredTags = existingTags.filter(
    (tag) => !tag.value.startsWith("Unprocessed") && !tag.value.startsWith("Bankruptcy")
  );

  return prisma.inboxItem.update({
    where: { id: itemId },
    data: {
      status: "pending",
      archivedAt: null,
      autoArchiveWarning: null,
      autoArchiveDate: null,
      tags: filteredTags,
    },
  });
}

interface ArchiveFilter {
  filter: "all" | "unprocessed" | "bankruptcy";
  limit?: number;
  cursor?: string;
}

interface Tag {
  type: string;
  value: string;
  confidence: number;
}

/**
 * Get archived items with filtering
 */
export async function getArchivedItems(userId: string, options: ArchiveFilter) {
  const { filter, limit = 50, cursor } = options;

  const items = await prisma.inboxItem.findMany({
    where: {
      userId,
      status: "archived",
    },
    orderBy: { archivedAt: "desc" },
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    select: {
      id: true,
      content: true,
      type: true,
      source: true,
      tags: true,
      createdAt: true,
      archivedAt: true,
    },
  });

  // Filter by tag type in memory (JSON field filtering)
  let filteredItems = items;
  if (filter !== "all") {
    const prefix = filter === "unprocessed" ? "Unprocessed" : "Bankruptcy";
    filteredItems = items.filter((item) => {
      const tags = item.tags as unknown as Tag[] | null;
      return tags?.some((tag) => tag.value.startsWith(prefix));
    });
  }

  // Get counts
  const allItems = await prisma.inboxItem.findMany({
    where: { userId, status: "archived" },
    select: { tags: true },
  });

  const total = allItems.length;
  const unprocessed = allItems.filter((item) => {
    const tags = item.tags as unknown as Tag[] | null;
    return tags?.some((tag) => tag.value.startsWith("Unprocessed"));
  }).length;
  const bankruptcy = allItems.filter((item) => {
    const tags = item.tags as unknown as Tag[] | null;
    return tags?.some((tag) => tag.value.startsWith("Bankruptcy"));
  }).length;

  const hasMore = filteredItems.length > limit;
  const trimmedItems = hasMore ? filteredItems.slice(0, -1) : filteredItems;

  return {
    items: trimmedItems,
    nextCursor: hasMore ? trimmedItems[trimmedItems.length - 1]?.id : undefined,
    total,
    unprocessed,
    bankruptcy,
  };
}
