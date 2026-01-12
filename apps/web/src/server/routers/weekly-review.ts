import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  getCurrentSession,
  startSession,
  completeStep,
  updateStepData,
  getSessionHistory,
  type ReviewStep,
  type ObjectivesStepData,
  type PrioritiesStepData,
  type ActionsStepData,
  type InboxStepData,
} from "../services/weekly-review.service";
import {
  getNeedsReviewQueue,
  getDisagreementsQueue,
  getQueueCounts,
  archiveQueueItems,
  fileQueueItemsTo,
  archiveInboxItem,
} from "../services/inbox-queues.service";

const reviewStepSchema = z.enum(["objectives", "priorities", "actions", "inbox"]);

const objectivesStepDataSchema = z.object({
  confirmed: z.array(z.string().uuid()),
  added: z.array(z.string().uuid()),
  deferred: z.array(z.string().uuid()),
});

const prioritiesStepDataSchema = z.object({
  selectedProjects: z.array(z.string().uuid()),
  selectedAreas: z.array(z.string().uuid()),
});

const actionsStepDataSchema = z.object({
  reviewed: z.array(z.string().uuid()),
  scheduled: z.array(z.string().uuid()),
  completed: z.array(z.string().uuid()),
});

const inboxStepDataSchema = z.object({
  needsReview: z.object({
    processed: z.number(),
    remaining: z.number(),
  }),
  disagreements: z.object({
    processed: z.number(),
    remaining: z.number(),
  }),
});

export const weeklyReviewRouter = router({
  /**
   * Get current week's review session
   */
  getSession: protectedProcedure.query(async ({ ctx }) => {
    return getCurrentSession(ctx.session.user.id);
  }),

  /**
   * Start or resume a weekly review session
   */
  startSession: protectedProcedure.mutation(async ({ ctx }) => {
    return startSession(ctx.session.user.id);
  }),

  /**
   * Complete a step and advance to the next
   */
  completeStep: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        step: reviewStepSchema,
        data: z
          .union([
            objectivesStepDataSchema,
            prioritiesStepDataSchema,
            actionsStepDataSchema,
            inboxStepDataSchema,
          ])
          .nullable()
          .optional(),
        goBack: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await completeStep(
          ctx.session.user.id,
          input.sessionId,
          input.step as ReviewStep,
          input.data as ObjectivesStepData | PrioritiesStepData | ActionsStepData | InboxStepData | null,
          input.goBack
        );
      } catch (error) {
        if (error instanceof Error && error.message === "Session not found") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Weekly review session not found",
          });
        }
        throw error;
      }
    }),

  /**
   * Update step data without advancing
   */
  updateStepData: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        step: reviewStepSchema,
        data: z.record(z.string(), z.unknown()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateStepData(
          ctx.session.user.id,
          input.sessionId,
          input.step as ReviewStep,
          input.data as Partial<ObjectivesStepData | PrioritiesStepData | ActionsStepData | InboxStepData>
        );
      } catch (error) {
        if (error instanceof Error && error.message === "Session not found") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Weekly review session not found",
          });
        }
        throw error;
      }
    }),

  /**
   * Get history of completed review sessions
   */
  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      return getSessionHistory(ctx.session.user.id, input.limit);
    }),

  // Inbox queue procedures for Story 5.4

  /**
   * Get items that need review (low confidence)
   */
  getNeedsReview: protectedProcedure.query(async ({ ctx }) => {
    return getNeedsReviewQueue(ctx.session.user.id);
  }),

  /**
   * Get items user disagreed with
   */
  getDisagreements: protectedProcedure.query(async ({ ctx }) => {
    return getDisagreementsQueue(ctx.session.user.id);
  }),

  /**
   * Get queue counts
   */
  getQueueCounts: protectedProcedure.query(async ({ ctx }) => {
    return getQueueCounts(ctx.session.user.id);
  }),

  /**
   * Archive all items in a queue
   */
  archiveAll: protectedProcedure
    .input(
      z.object({
        queue: z.enum(["needsReview", "disagreements"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return archiveQueueItems(ctx.session.user.id, input.queue);
    }),

  /**
   * File all items in a queue to a destination
   */
  fileAllTo: protectedProcedure
    .input(
      z.object({
        queue: z.enum(["needsReview", "disagreements"]),
        destination: z.object({
          type: z.enum(["project", "area"]),
          id: z.string().uuid(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return fileQueueItemsTo(ctx.session.user.id, input.queue, input.destination);
    }),

  /**
   * Archive a single inbox item
   */
  archiveItem: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return archiveInboxItem(ctx.session.user.id, input.id);
    }),
});
