import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { prisma } from "@packages/db";

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
});
