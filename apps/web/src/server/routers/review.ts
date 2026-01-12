import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { prisma } from "@packages/db";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import {
  handleSwipe,
  undoSwipe,
  getOrCreateSession,
  recordSessionAction,
  markActionUndone,
  completeSession,
  type SessionAction,
} from "../services/review.service";
import { processCorrection } from "../services/correction.service";

const swipeDirectionSchema = z.enum(["right", "left", "up", "down"]);

export const reviewRouter = router({
  /**
   * Get active (incomplete, non-expired) review session
   */
  getActiveSession: protectedProcedure.query(async ({ ctx }) => {
    const session = await prisma.reviewSession.findFirst({
      where: {
        userId: ctx.session.user.id,
        completedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { startedAt: "desc" },
    });

    if (!session) return null;

    // Fetch items for the session
    const items = await prisma.inboxItem.findMany({
      where: { id: { in: session.itemIds } },
    });

    // Maintain original order using O(1) Map lookup instead of O(n) find
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const orderedItems = session.itemIds
      .map((id: string) => itemMap.get(id))
      .filter((item): item is NonNullable<typeof item> => item !== undefined);

    return {
      ...session,
      items: orderedItems,
    };
  }),

  /**
   * Start a new review session (or get existing)
   */
  startSession: protectedProcedure
    .input(
      z
        .object({
          forceNew: z.boolean().default(false),
        })
        .optional()
    )
    .mutation(async ({ ctx, input }) => {
      const session = await getOrCreateSession(
        ctx.session.user.id,
        input?.forceNew
      );

      // Fetch items for the session
      const items = await prisma.inboxItem.findMany({
        where: { id: { in: session.itemIds } },
      });

      // Maintain original order using O(1) Map lookup instead of O(n) find
      const itemMap = new Map(items.map((i) => [i.id, i]));
      const orderedItems = session.itemIds
        .map((id: string) => itemMap.get(id))
        .filter((item): item is NonNullable<typeof item> => item !== undefined);

      return {
        ...session,
        items: orderedItems,
      };
    }),

  /**
   * Record a swipe action
   */
  recordSwipe: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        itemId: z.string().uuid(),
        direction: swipeDirectionSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify session ownership
      const session = await prisma.reviewSession.findUnique({
        where: { id: input.sessionId },
      });

      if (!session || session.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      // Get the item
      const item = await prisma.inboxItem.findUnique({
        where: { id: input.itemId, userId: ctx.session.user.id },
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }

      // Handle the swipe action
      const result = await handleSwipe(input.direction, item, input.sessionId);

      // Record the action in the session
      const sessionAction: SessionAction = {
        id: randomUUID(),
        itemId: input.itemId,
        action: result.action,
        timestamp: new Date().toISOString(),
        undone: false,
        previousState: result.previousState,
      };

      await recordSessionAction(input.sessionId, sessionAction);

      return result;
    }),

  /**
   * Undo a swipe action
   */
  undoSwipe: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        itemId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify session ownership
      const session = await prisma.reviewSession.findUnique({
        where: { id: input.sessionId },
      });

      if (!session || session.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      // Find the last action for this item
      const actions = (session.actions as unknown as SessionAction[]) || [];
      const lastAction = actions.findLast(
        (a) => a.itemId === input.itemId && !a.undone
      );

      if (!lastAction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No action to undo",
        });
      }

      // Perform the undo
      const result = await undoSwipe(input.itemId, lastAction.previousState);

      // Mark the action as undone in the session
      await markActionUndone(input.sessionId, input.itemId);

      return result;
    }),

  /**
   * Update session state (for auto-save)
   */
  updateSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        currentIndex: z.number().optional(),
        lastActivityAt: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return prisma.reviewSession.update({
        where: {
          id: input.sessionId,
          userId: ctx.session.user.id,
        },
        data: {
          currentIndex: input.currentIndex,
          lastActivityAt: input.lastActivityAt || new Date(),
        },
      });
    }),

  /**
   * Complete a review session
   */
  completeSession: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const session = await prisma.reviewSession.findUnique({
        where: { id: input.sessionId },
      });

      if (!session || session.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      return completeSession(input.sessionId);
    }),

  /**
   * Get session history
   */
  getSessionHistory: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ ctx, input }) => {
      return prisma.reviewSession.findMany({
        where: {
          userId: ctx.session.user.id,
          completedAt: { not: null },
        },
        orderBy: { completedAt: "desc" },
        take: input.limit,
        select: {
          id: true,
          startedAt: true,
          completedAt: true,
          itemIds: true,
          stats: true,
        },
      });
    }),

  /**
   * Submit a correction for an item
   */
  submitCorrection: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        inboxItemId: z.string().uuid(),
        correctionType: z.enum(["fix_now", "weekly_review"]),
        correctedCategory: z.string().optional(),
        correctedActions: z
          .array(
            z.object({
              originalId: z.string().optional(),
              description: z.string(),
              keep: z.boolean(),
              isNew: z.boolean(),
            })
          )
          .optional(),
        userReason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate ownership
      const item = await prisma.inboxItem.findUnique({
        where: { id: input.inboxItemId, userId: ctx.session.user.id },
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }

      // Verify session ownership
      const session = await prisma.reviewSession.findUnique({
        where: { id: input.sessionId },
      });

      if (!session || session.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      return processCorrection({
        ...input,
        userId: ctx.session.user.id,
      });
    }),
});
