import { NextResponse } from "next/server";
import { prisma } from "@packages/db";
import { indexContent } from "@/server/services/search-index.service";

const BATCH_SIZE = 50;

/**
 * Batch reindex endpoint for items without search embeddings
 * Called by n8n daily cron job to ensure all items are indexed
 *
 * POST /api/internal/reindex
 * Headers: X-Internal-Secret: <secret>
 */
export async function POST(request: Request) {
  // Validate internal request
  const secret = request.headers.get("X-Internal-Secret");
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  let indexed = 0;
  let failed = 0;
  let skipped = 0;

  try {
    // Get IDs of already indexed inbox items
    const existingIndexIds = await prisma.searchIndex.findMany({
      where: { sourceType: "INBOX_ITEM" },
      select: { sourceId: true },
    });
    const indexedIds = new Set(existingIndexIds.map((i) => i.sourceId));

    // Find inbox items without search index entries
    const unindexedItems = await prisma.inboxItem.findMany({
      where: {
        status: { in: ["reviewed", "pending"] },
        NOT: {
          id: { in: Array.from(indexedIds) },
        },
      },
      take: BATCH_SIZE,
      select: {
        id: true,
        userId: true,
        content: true,
        aiClassification: true,
        tags: true,
      },
    });

    console.log(
      `[Reindex] Found ${unindexedItems.length} items to index (batch size: ${BATCH_SIZE})`
    );

    for (const item of unindexedItems) {
      try {
        // Skip items with empty content
        if (!item.content?.trim()) {
          skipped++;
          continue;
        }

        const classification = item.aiClassification as {
          category?: string;
          reasoning?: string;
          extractedActions?: Array<{ description: string }>;
        } | null;

        const tags = item.tags as Array<{ value: string }> | null;

        // Build searchable content
        const searchableContent = [
          item.content,
          classification?.reasoning,
          classification?.extractedActions?.map((a) => a.description).join(" "),
          tags?.map((t) => t.value).join(" "),
        ]
          .filter(Boolean)
          .join("\n\n");

        const title = classification?.extractedActions?.[0]?.description || item.content.slice(0, 100);

        await indexContent({
          sourceType: "INBOX_ITEM",
          sourceId: item.id,
          userId: item.userId,
          content: searchableContent,
          title,
          tags: tags?.map((t) => t.value) || [],
        });

        indexed++;
      } catch (error) {
        console.error(`[Reindex] Failed to index item ${item.id}:`, error);
        failed++;
      }
    }

    // Count remaining unindexed items
    const updatedIndexIds = await prisma.searchIndex.findMany({
      where: { sourceType: "INBOX_ITEM" },
      select: { sourceId: true },
    });
    const updatedIndexedSet = new Set(updatedIndexIds.map((i) => i.sourceId));

    const remainingCount = await prisma.inboxItem.count({
      where: {
        status: { in: ["reviewed", "pending"] },
        NOT: {
          id: { in: Array.from(updatedIndexedSet) },
        },
      },
    });

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      indexed,
      failed,
      skipped,
      remaining: remainingCount,
      durationMs,
      message:
        remainingCount > 0
          ? `Indexed ${indexed} items. ${remainingCount} items remaining.`
          : "All items indexed.",
    });
  } catch (error) {
    console.error("[Reindex] Batch reindex failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        indexed,
        failed,
        skipped,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check reindex status
 */
export async function GET(request: Request) {
  // Validate internal request
  const secret = request.headers.get("X-Internal-Secret");
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Count indexed items
    const indexedCount = await prisma.searchIndex.count({
      where: { sourceType: "INBOX_ITEM" },
    });

    // Get IDs of indexed items
    const indexedIds = await prisma.searchIndex.findMany({
      where: { sourceType: "INBOX_ITEM" },
      select: { sourceId: true },
    });
    const indexedSet = new Set(indexedIds.map((i) => i.sourceId));

    // Count unindexed items
    const unindexedCount = await prisma.inboxItem.count({
      where: {
        status: { in: ["reviewed", "pending"] },
        NOT: {
          id: { in: Array.from(indexedSet) },
        },
      },
    });

    // Total inbox items
    const totalItems = await prisma.inboxItem.count({
      where: { status: { in: ["reviewed", "pending"] } },
    });

    return NextResponse.json({
      indexed: indexedCount,
      unindexed: unindexedCount,
      total: totalItems,
      percentComplete: totalItems > 0 ? Math.round((indexedCount / totalItems) * 100) : 100,
    });
  } catch (error) {
    console.error("[Reindex] Status check failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
