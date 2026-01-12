import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { prisma } from "@packages/db";
import { n8nService } from "@/lib/services/n8n";
import { classificationService, type ProcessingMeta } from "../services/classification.service";
import {
  getAutoArchiveWarnings,
  getPendingCount,
  declareBankruptcy,
  getArchivedItems,
  restoreFromArchive,
} from "../services/auto-archive.service";

const inboxItemTypeSchema = z.enum([
  "manual",
  "image",
  "voice",
  "email",
  "forward",
]);

export const inboxRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        type: inboxItemTypeSchema,
        content: z.string().max(10000, "Content must be 10,000 characters or less"),
        source: z.string(),
        mediaUrl: z.string().url().optional(),
      }).refine(
        (data) => {
          // For image type, mediaUrl is required
          if (data.type === "image" && !data.mediaUrl) {
            return false;
          }
          // For non-image types, content is required
          if (data.type !== "image" && !data.content.trim()) {
            return false;
          }
          return true;
        },
        {
          message: "Content is required for text captures, mediaUrl is required for images",
        }
      )
    )
    .mutation(async ({ ctx, input }) => {
      const inboxItem = await prisma.inboxItem.create({
        data: {
          userId: ctx.userId,
          type: input.type,
          content: input.content || `Image captured at ${new Date().toISOString()}`,
          source: input.source,
          mediaUrl: input.mediaUrl,
          status: "pending",
        },
      });

      // Trigger AI classification asynchronously (fire-and-forget)
      // Only classify text-based items (not images without content)
      if (inboxItem.content && inboxItem.type !== "image") {
        n8nService.triggerClassification({
          id: inboxItem.id,
          content: inboxItem.content,
          source: inboxItem.source,
          type: inboxItem.type,
          createdAt: inboxItem.createdAt,
        }).catch((error) => {
          console.error("[InboxRouter] Failed to trigger classification:", error);
        });
      }

      return inboxItem;
    }),

  count: protectedProcedure.query(async ({ ctx }) => {
    const count = await prisma.inboxItem.count({
      where: {
        userId: ctx.userId,
        status: { in: ["pending", "processing"] },
      },
    });

    return { count };
  }),

  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["pending", "processing", "reviewed", "archived"]).optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const items = await prisma.inboxItem.findMany({
        where: {
          userId: ctx.userId,
          ...(input.status && { status: input.status }),
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          content: true,
          source: true,
          status: true,
          mediaUrl: true,
          aiClassification: true,
          createdAt: true,
        },
      });

      let nextCursor: string | undefined = undefined;
      if (items.length > input.limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items,
        nextCursor,
      };
    }),

  // Story 3.4: Bouncer System - Needs Review count
  needsReviewCount: protectedProcedure.query(async ({ ctx }) => {
    // Count items that have been classified but need manual review (low confidence)
    const count = await prisma.inboxItem.count({
      where: {
        userId: ctx.userId,
        status: "pending",
        aiClassification: { not: { equals: undefined } },
      },
    });

    return { count };
  }),

  // Story 3.4: Bouncer System - Get receipts (auto-filed items)
  receipts: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const receipts = await prisma.classificationAudit.findMany({
        where: {
          userId: ctx.userId,
          reviewType: "auto",
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          inboxItem: {
            select: {
              id: true,
              content: true,
              type: true,
              source: true,
              createdAt: true,
            },
          },
        },
      });

      let nextCursor: string | undefined = undefined;
      if (receipts.length > input.limit) {
        const nextItem = receipts.pop();
        nextCursor = nextItem?.id;
      }

      return {
        receipts,
        nextCursor,
      };
    }),

  // Story 3.4: Get single inbox item detail
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const item = await prisma.inboxItem.findUnique({
        where: { id: input.id },
        include: {
          audits: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!item || item.userId !== ctx.userId) {
        return null;
      }

      return item;
    }),

  // Story 3.5: Queue metrics for monitoring
  queueMetrics: protectedProcedure.query(async ({ ctx }) => {
    const [pending, processing, error, reviewed, total] = await Promise.all([
      prisma.inboxItem.count({
        where: { userId: ctx.userId, status: "pending" },
      }),
      prisma.inboxItem.count({
        where: { userId: ctx.userId, status: "processing" },
      }),
      prisma.inboxItem.count({
        where: { userId: ctx.userId, status: "error" },
      }),
      prisma.inboxItem.count({
        where: { userId: ctx.userId, status: "reviewed" },
      }),
      prisma.inboxItem.count({
        where: { userId: ctx.userId },
      }),
    ]);

    return { pending, processing, error, reviewed, total };
  }),

  // Story 3.5: Watch status for real-time polling
  watchStatus: protectedProcedure
    .input(z.object({ itemIds: z.array(z.string().uuid()) }))
    .query(async ({ ctx, input }) => {
      if (input.itemIds.length === 0) {
        return [];
      }

      const items = await prisma.inboxItem.findMany({
        where: {
          id: { in: input.itemIds },
          userId: ctx.userId,
        },
        select: {
          id: true,
          status: true,
          aiClassification: true,
        },
      });

      return items.map((item) => {
        const classification = item.aiClassification as Record<string, unknown> | null;
        const processingMeta = (classification?.processingMeta as ProcessingMeta) ?? {};

        return {
          id: item.id,
          status: item.status,
          category: classification?.category as string | undefined,
          confidence: classification?.confidence as number | undefined,
          error: processingMeta.lastError,
          retryCount: processingMeta.retryCount ?? 0,
        };
      });
    }),

  // Story 3.5: Retry classification for error items
  retryClassification: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership and error state
      const item = await prisma.inboxItem.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          userId: true,
          status: true,
          content: true,
          source: true,
          type: true,
          createdAt: true,
        },
      });

      if (!item || item.userId !== ctx.userId) {
        return { success: false, error: "Item not found" };
      }

      if (item.status !== "error") {
        return { success: false, error: "Item is not in error state" };
      }

      // Reset the item for retry
      const resetResult = await classificationService.resetForRetry(input.id);
      if (!resetResult.success) {
        return resetResult;
      }

      // Trigger classification again
      n8nService.triggerClassification({
        id: item.id,
        content: item.content,
        source: item.source,
        type: item.type,
        createdAt: item.createdAt,
      }).catch((error) => {
        console.error("[InboxRouter] Failed to trigger retry classification:", error);
      });

      return { success: true };
    }),

  // Story 3.5: Get items in error state
  errorItems: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const items = await prisma.inboxItem.findMany({
        where: {
          userId: ctx.userId,
          status: "error",
        },
        take: input.limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          content: true,
          source: true,
          status: true,
          aiClassification: true,
          createdAt: true,
        },
      });

      return items.map((item) => {
        const classification = item.aiClassification as Record<string, unknown> | null;
        const processingMeta = (classification?.processingMeta as ProcessingMeta) ?? {};

        return {
          ...item,
          processingMeta: {
            lastError: processingMeta.lastError,
            retryCount: processingMeta.retryCount ?? 0,
            failedAt: processingMeta.failedAt,
          },
        };
      });
    }),

  // Story 5.5: Auto-Archive & Bankruptcy

  /**
   * Get items with auto-archive warnings
   */
  getAutoArchiveWarnings: protectedProcedure.query(async ({ ctx }) => {
    return getAutoArchiveWarnings(ctx.userId);
  }),

  /**
   * Get pending item count
   */
  getPendingCount: protectedProcedure.query(async ({ ctx }) => {
    return getPendingCount(ctx.userId);
  }),

  /**
   * Declare inbox bankruptcy
   */
  declareBankruptcy: protectedProcedure.mutation(async ({ ctx }) => {
    return declareBankruptcy(ctx.userId);
  }),

  /**
   * Get archived items with filtering
   */
  getArchived: protectedProcedure
    .input(
      z.object({
        filter: z.enum(["all", "unprocessed", "bankruptcy"]).default("all"),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return getArchivedItems(ctx.userId, input);
    }),

  /**
   * Restore item from archive
   */
  restore: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return restoreFromArchive(ctx.userId, input.id);
    }),

  /**
   * Archive a single item
   */
  archive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return prisma.inboxItem.update({
        where: { id: input.id, userId: ctx.userId },
        data: {
          status: "archived",
          archivedAt: new Date(),
        },
      });
    }),
});
